import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminCommandSchema } from "@/lib/admin-command-schema";
import { applyCommand, ConflictError } from "@/lib/admin-command";
import { createHash } from "node:crypto";
import {
  db,
  revoke,
  principal,
  login,
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
import { boundedBody, PayloadLimit, trustedOrigin } from "@/lib/request";
import { loginBucket } from "@/lib/login-limit";
export const runtime = "nodejs";
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
  if (
    ["score", "clock", "status", "undo", "correct"].includes(b.action) &&
    (!b.id ||
      !Number.isInteger(b.version) ||
      (b.version ?? -1) < 0 ||
      (b.action === "score" &&
        (!b.side || ![1, 2, 3].includes(b.points || 0))) ||
      (b.action === "status" && !b.status))
  )
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
    const token = await db.transaction(async () => {
      const token = await login(b.password || "", ident?.value ?? "");
      if (!token) return null;
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
      return token;
    })();
    if (!token)
      return NextResponse.json(
        {
          error:
            "بيانات الدخول غير صحيحة، أو لم يُنشأ حساب بهذا البريد/الهاتف بعد.",
        },
        { status: 401 },
      );
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
      me: {
        id: me.id,
        identifier: me.identifier,
        role: me.role,
        permissions: permissionsOf(me.role),
      },
      users: can(me.role, "users:manage") ? await listUsers() : undefined,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
