import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminCommandSchema, validControlCommand } from "@/lib/admin-command-schema";
import { applyCommand, ConflictError } from "@/lib/admin-command";
import { createHash } from "node:crypto";
import {
  db,
  revoke,
  principal,
  authenticate,
  beginTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
  resetTwoFactor,
  rateLimit,
  rateLimitReset,
  snapshotData,
  listUsers,
  createUser,
  setUserRole,
  setUserDisabled,
  resetPassword,
  deleteUser,
} from "@/lib/store";
import { can, permissionsOf, requiredPermission } from "@/lib/permissions";
import { normalizeIdentifier } from "@/lib/identifier";
import { twoFactorConfigured } from "@/lib/secret-box";
import QRCode from "qrcode";
import { boundedBody, PayloadLimit, trustedOrigin } from "@/lib/request";
import { loginBucket } from "@/lib/login-limit";
export const runtime = "nodejs";
const requireTwoFactor = () => process.env.REQUIRE_2FA === "1";
export async function POST(req: NextRequest) {
  if (!trustedOrigin(req))
    return NextResponse.json({ error: "Origin rejected" }, { status: 403 });
  if (Number(req.headers.get("content-length") || 0) > 100000)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let raw: unknown;
  try {
    const body = new TextDecoder().decode(await boundedBody(req, 100000));
    if (body.length > 100000) throw Error("Payload too large");
    raw = JSON.parse(body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid JSON" },
      { status: e instanceof PayloadLimit ? 413 : 400 },
    );
  }
  const parsed = adminCommandSchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const b = parsed.data;
  if (!validControlCommand(b))
    return NextResponse.json(
      { error: "Invalid control command" },
      { status: 400 },
    );
  const jar = await cookies();
  if (b.action === "login") {
    let bucket: string;
    try {
      bucket = loginBucket(req);
    } catch {
      return NextResponse.json(
        { error: "Proxy configuration rejected" },
        { status: 403 },
      );
    }
    // A second bucket per account throttles guessing against one email/phone from many addresses.
    const ident = normalizeIdentifier(b.identifier);
    const accountBucket =
      "login-id:" +
      createHash("sha256")
        .update(ident?.value ?? "invalid")
        .digest("hex")
        .slice(0, 32);
    if (
      !(await rateLimit(bucket, 10, 15 * 60000)) ||
      !(await rateLimit(accountBucket, 8, 15 * 60000))
    )
      return NextResponse.json(
        { error: "محاولات كثيرة. حاول بعد 15 دقيقة." },
        { status: 429 },
      );
    // Password hashing is slow by design, so it runs outside any database transaction.
    const result = await authenticate(
      b.password || "",
      ident?.value ?? "",
      b.otp,
    );
    const outcome =
      result.status === "ok"
        ? await db.transaction(async () => {
            await db
              .prepare(
                "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,'login')",
              )
              .run(
                ident!.value,
                "auth",
                ident!.value,
                null,
                JSON.stringify({ event: "login" }),
                new Date().toISOString(),
              );
            return result;
          })()
        : result;
    // Password right, authenticator code still needed (or wrong): the attempt stays counted.
    if (outcome.status === "otp")
      return NextResponse.json(
        { error: "أدخل رمز التحقق من تطبيق المصادقة.", needOtp: true },
        { status: 401 },
      );
    if (outcome.status !== "ok")
      return NextResponse.json(
        {
          error:
            "بيانات الدخول غير صحيحة، أو لم يُنشأ حساب بهذا البريد/الهاتف بعد.",
        },
        { status: 401 },
      );
    const token = outcome.token;
    // Only failed attempts count toward the limit.
    await rateLimitReset(bucket);
    await rateLimitReset(accountBucket);
    jar.set("road-session", token, {
      httpOnly: true,
      secure: new URL(process.env.SITE_URL || req.url).protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: 28800,
    });
    return NextResponse.json({ ok: true });
  }
  const me = await principal(jar.get("road-session")?.value);
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = me.id;
  if (!(await rateLimit("admin:" + actor, 240)))
    return NextResponse.json({ error: "Too many changes" }, { status: 429 });
  if (b.action === "logout") {
    await db.transaction(async () => {
      await revoke(jar.get("road-session")?.value);
      await db
        .prepare(
          "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,'logout')",
        )
        .run(
          actor,
          "auth",
          actor,
          null,
          JSON.stringify({ event: "logout" }),
          new Date().toISOString(),
        );
    })();
    jar.delete("road-session");
    return NextResponse.json({ ok: true });
  }
  // Optional policy: every account must have an authenticator before it can do anything else.
  const mustEnrol = requireTwoFactor() && !me.twoFactor;
  if (mustEnrol && !b.action.startsWith("2fa:"))
    return NextResponse.json(
      { error: "فعّل التحقق الثنائي أولاً.", code: "2fa-required" },
      { status: 403 },
    );
  if (b.action.startsWith("2fa:")) {
    if (!(await rateLimit("2fa:" + actor, 10, 15 * 60000)))
      return NextResponse.json(
        { error: "محاولات كثيرة. حاول بعد 15 دقيقة." },
        { status: 429 },
      );
    try {
      let extra: Record<string, unknown> = {};
      if (b.action === "2fa:begin") {
        const started = await beginTwoFactor(actor);
        extra = {
          secret: started.secret,
          uri: started.uri,
          qr: await QRCode.toDataURL(started.uri, { margin: 1, width: 240 }),
        };
      } else if (b.action === "2fa:confirm")
        extra = { recoveryCodes: await confirmTwoFactor(actor, b.otp ?? "") };
      else if (b.action === "2fa:disable")
        await disableTwoFactor(actor, b.password ?? "", b.otp ?? "");
      else
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      await db
        .prepare(
          "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          actor,
          "auth",
          actor,
          null,
          JSON.stringify({ event: b.action }),
          new Date().toISOString(),
          b.action,
        );
      await rateLimitReset("2fa:" + actor);
      return NextResponse.json({ ok: true, ...extra });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "تعذر تنفيذ الإجراء" },
        { status: 400 },
      );
    }
  }
  // Role-based access control: every command needs a permission the role holds.
  if (!can(me.role, requiredPermission(b)))
    return NextResponse.json(
      { error: "ليست لديك صلاحية لتنفيذ هذا الإجراء." },
      { status: 403 },
    );
  if (b.action.startsWith("user:")) {
    try {
      let target = b.id ?? "";
      if (b.action === "user:create")
        target = await createUser(b.identifier ?? "", b.password ?? "", b.role ?? "");
      else if (b.action === "user:role")
        await setUserRole(target, b.role ?? "");
      else if (b.action === "user:password")
        await resetPassword(target, b.password ?? "");
      else if (b.action === "user:disable") await setUserDisabled(target, true);
      else if (b.action === "user:enable") await setUserDisabled(target, false);
      else if (b.action === "user:delete") await deleteUser(target);
      else if (b.action === "user:2fa-reset") await resetTwoFactor(target);
      else
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      // Passwords are never written to the audit trail.
      await db
        .prepare(
          "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,?)",
        )
        .run(
          actor,
          "users",
          target,
          null,
          JSON.stringify({ role: b.role ?? null }),
          new Date().toISOString(),
          b.action,
        );
      return NextResponse.json({ ok: true, users: await listUsers() });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "تعذر تنفيذ الإجراء" },
        { status: 400 },
      );
    }
  }
  try {
    await applyCommand(b, actor);
    return NextResponse.json({ ok: true, data: await snapshotData() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذر حفظ التغيير" },
      { status: e instanceof ConflictError ? 409 : 400 },
    );
  }
}
export async function GET() {
  const me = await principal((await cookies()).get("road-session")?.value);
  if (!me)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = (await db.prepare("SELECT kind,body FROM records").all()) as {
    kind: string;
    body: string;
  }[];
  const twoFactorState = {
    enabled: !!me.twoFactor,
    required: requireTwoFactor(),
    available: twoFactorConfigured(),
  };
  const meBody = {
    id: me.id,
    identifier: me.identifier,
    role: me.role,
    permissions: permissionsOf(me.role),
    twoFactor: twoFactorState,
  };
  if (twoFactorState.required && !twoFactorState.enabled)
    return NextResponse.json(
      { me: meBody },
      { headers: { "Cache-Control": "no-store" } },
    );
  let fiba: unknown = null;
  try {
    fiba =
      (await db
        .prepare(
          "SELECT finished,mode,status,error FROM fiba_sync_runs ORDER BY id DESC LIMIT 1",
        )
        .get()) ?? null;
  } catch {
    // The sync tables are created on the first FIBA run.
  }
  return NextResponse.json(
    {
      fiba,
      records: records.map((r) => ({
        kind: r.kind,
        value: JSON.parse(r.body),
      })),
      // The audit trail names every account, so only roles that run the tournament can read it.
      audit: can(me.role, "tournament:write")
        ? await db
            .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 100")
            .all()
        : [],
      me: meBody,
      users: can(me.role, "users:manage") ? await listUsers() : undefined,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
