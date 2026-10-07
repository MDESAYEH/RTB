import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminCommandSchema } from "@/lib/admin-command-schema";
import { applyCommand, ConflictError } from "@/lib/admin-command";
import {
  db,
  revoke,
  authorize,
  login,
  rateLimit,
  snapshotData,
} from "@/lib/store";
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
    if (!(await rateLimit(bucket, 10, 15 * 60000)))
      return NextResponse.json(
        { error: "محاولات كثيرة. حاول بعد 15 دقيقة." },
        { status: 429 },
      );
    const token = await db.transaction(async () => {
      const token = await login(b.password || "");
      if (!token) return null;
      await db
        .prepare(
          "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,'login')",
        )
        .run(
          "admin",
          "auth",
          "admin",
          null,
          JSON.stringify({ event: "login" }),
          new Date().toISOString(),
        );
      return token;
    })();
    if (!token)
      return NextResponse.json(
        { error: "������ ������ ��� ����� �� �� ����� ���� �������." },
        { status: 401 },
      );
    jar.set("road-session", token, {
      httpOnly: true,
      secure: new URL(process.env.SITE_URL || req.url).protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: 28800,
    });
    return NextResponse.json({ ok: true });
  }
  const actor = await authorize(jar.get("road-session")?.value);
  if (!actor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const actor = await authorize((await cookies()).get("road-session")?.value);
  if (!actor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = (await db.prepare("SELECT kind,body FROM records").all()) as {
    kind: string;
    body: string;
  }[];
  return NextResponse.json(
    {
      records: records.map((r) => ({
        kind: r.kind,
        value: JSON.parse(r.body),
      })),
      audit: await db
        .prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 100")
        .all(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
