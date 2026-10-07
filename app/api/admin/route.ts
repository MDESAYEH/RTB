import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  db,
  revision,
  revoke,
  authorize,
  login,
  rateLimit,
  schemas,
  get,
  write,
  settings,
  list,
} from "@/lib/store";
import {
  qualification,
  score,
  transition,
  remainingClock,
  gameSchema,
  type Team,
  type Game,
} from "@/lib/domain";
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
  const parsed = z
    .object({
      action: z.string(),
      password: z.string().max(256).optional(),
      kind: z.string().optional(),
      id: z.string().optional(),
      value: z.unknown().optional(),
      version: z.number().optional(),
      side: z.enum(["home", "away"]).optional(),
      points: z.number().optional(),
      status: z
        .enum([
          "Scheduled",
          "Warmup",
          "Live",
          "Halftime",
          "Ended",
          "Postponed",
          "Cancelled",
        ])
        .optional(),
      clock: z.number().optional(),
      quarter: z.number().optional(),
      running: z.boolean().optional(),
      requestId: z.string().uuid().optional(),
      reason: z.string().trim().min(8).max(400).optional(),
      confirmed: z.literal(true).optional(),
    })
    .safeParse(raw);
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
    if (!rateLimit(bucket, 10, 15 * 60000))
      return NextResponse.json(
        { error: "محاولات كثيرة. حاول بعد 15 دقيقة." },
        { status: 429 },
      );
    const token = login(b.password || "");
    if (!token)
      return NextResponse.json(
        { error: "بيانات الدخول غير صحيحة أو لم يُنشأ حساب الإدارة." },
        { status: 401 },
      );
    db.prepare(
      "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,'login')",
    ).run(
      "admin",
      "auth",
      "admin",
      null,
      JSON.stringify({ event: "login" }),
      new Date().toISOString(),
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
  const actor = authorize(jar.get("road-session")?.value);
  if (!actor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit("admin:" + actor, 240))
    return NextResponse.json({ error: "Too many changes" }, { status: 429 });
  if (b.action === "logout") {
    revoke(jar.get("road-session")?.value);
    jar.delete("road-session");
    db.prepare(
      "INSERT INTO audit(actor,kind,target,old,new,time,action) VALUES(?,?,?,?,?,?,'logout')",
    ).run(
      actor,
      "auth",
      actor,
      null,
      JSON.stringify({ event: "logout" }),
      new Date().toISOString(),
    );
    return NextResponse.json({ ok: true });
  }
  try {
    db.transaction(() => {
      if (b.requestId) {
        const seen = db
          .prepare("SELECT body FROM commands WHERE actor=? AND id=?")
          .get(actor, b.requestId) as { body: string } | undefined;
        if (seen) {
          if (seen.body !== JSON.stringify(b))
            throw Error("Request ID already used");
          return;
        }
        db.prepare("DELETE FROM commands WHERE time < ?").run(
          Date.now() - 86400000,
        );
        db.prepare(
          "INSERT INTO commands(actor,id,body,time) VALUES(?,?,?,?)",
        ).run(actor, b.requestId, JSON.stringify(b), Date.now());
      }
      if (b.action === "save") {
        if (!b.kind || !(b.kind in schemas)) throw Error("Unknown collection");
        const schema = schemas[b.kind as keyof typeof schemas];
        const value = schema.parse(b.value);
        const id =
          b.kind === "settings" ? "tournament" : (value as { id: string }).id;
        if (b.kind === "games") {
          const g = value as Game;
          const existing = get<Game>("games", id);
          if (
            existing &&
            (existing.status !== "Scheduled" || g.version !== existing.version)
          )
            throw Error(
              "استخدم غرفة التحكم للمباريات التي بدأت، أو حدّث الإصدار",
            );
          if (existing) {
            g.version = existing.version + 1;
            g.updatedAt = new Date().toISOString();
          }
          if (
            g.status !== "Scheduled" ||
            g.homeScore ||
            g.awayScore ||
            g.periods.length ||
            g.running ||
            g.quarter !== 1 ||
            g.clock !== 600
          )
            throw Error("New games must be scheduled without scores");
          const home = get<{ group: string }>("teams", g.home),
            away = get<{ group: string }>("teams", g.away);
          if (
            !home ||
            !away ||
            home.group !== g.group ||
            away.group !== g.group
          )
            throw Error("Teams must belong to the same group");
          if (!settings().groups.includes(g.group))
            throw Error("Unknown group");
        }
        if (b.kind === "settings") {
          const next = value as ReturnType<typeof settings>;
          if (
            list<{ group: string }>("teams").some(
              (t) => !next.groups.includes(t.group),
            )
          )
            throw Error("Existing teams need these groups");
          if (next.featuredGameId && !get("games", next.featuredGameId))
            throw Error("Unknown featured game");
        }
        if (b.kind === "teams") {
          const t = value as { id: string; group: string };
          if (
            list<Game>("games").some(
              (g) =>
                (g.home === t.id || g.away === t.id) && g.group !== t.group,
            )
          )
            throw Error(
              "Cannot move a team with scheduled games to another group",
            );
        }
        if (
          b.kind === "players" &&
          !get("teams", (value as { team: string }).team)
        )
          throw Error("Unknown team");
        if (
          b.kind === "teams" &&
          !settings().groups.includes((value as { group: string }).group)
        )
          throw Error("Unknown group");
        if (
          b.kind === "events" &&
          !get("games", (value as { game: string }).game)
        )
          throw Error("Unknown game");
        if (b.kind === "teamStats") {
          const v = value as { game: string; team: string };
          const g = get<Game>("games", v.game);
          if (!g || ![g.home, g.away].includes(v.team))
            throw Error("Team must play this game");
        }
        if (b.kind === "stats") {
          const v = value as { game: string; player: string };
          const g = get<Game>("games", v.game),
            p = get<{ team: string }>("players", v.player);
          if (!g || !p || ![g.home, g.away].includes(p.team))
            throw Error("Player must belong to a team in this game");
        }
        write(b.kind, id, value, actor);
        return;
      }
      const g = get<Game>("games", b.id || "");
      if (!g) throw Error("المباراة غير موجودة");
      if (b.version !== g.version)
        throw new ConflictError("تم تحديث المباراة من محرر آخر. حدّث الصفحة.");
      let next = { ...g, clock: remainingClock(g) };
      if (b.action === "score") next = score(next, b.side!, b.points!);
      else if (b.action === "status") next = transition(next, b.status!);
      else if (b.action === "correct") {
        if (!b.confirmed || !b.reason)
          throw Error("التصحيح يحتاج سببًا وتأكيدًا صريحًا");
        const corrected = gameSchema.parse(b.value);
        if (
          corrected.id !== g.id ||
          corrected.home !== g.home ||
          corrected.away !== g.away ||
          corrected.group !== g.group ||
          corrected.date !== g.date ||
          !["Live", "Halftime", "Ended"].includes(g.status) ||
          !["Live", "Halftime", "Ended"].includes(corrected.status)
        )
          throw Error("Invalid correction");
        if (
          corrected.periods.length > corrected.quarter ||
          corrected.periods.reduce((n, p) => n + p.home, 0) !==
            corrected.homeScore ||
          corrected.periods.reduce((n, p) => n + p.away, 0) !==
            corrected.awayScore
        )
          throw Error("مجموع الفترات يجب أن يطابق النتيجة");
        if (corrected.status === "Ended")
          transition({ ...corrected, status: "Live" }, "Ended");
        if (corrected.status === "Halftime")
          transition({ ...corrected, status: "Live" }, "Halftime");
        if (corrected.quarter > 4 && corrected.clock > 300)
          throw Error("Overtime is five minutes");
        next = { ...corrected, running: false };
        db.prepare("DELETE FROM undo WHERE game=?").run(g.id);
      } else if (b.action === "clock") {
        if (!["Live", "Halftime"].includes(g.status))
          throw Error("Clock changes require an active game");
        if (g.status !== "Live" && b.running)
          throw Error("Clock only runs during Live");
        next = gameSchema.parse({
          ...next,
          clock: b.clock ?? next.clock,
          quarter: b.quarter ?? next.quarter,
          running: b.running ?? next.running,
        });
        if (next.quarter < g.quarter || next.quarter > g.quarter + 1)
          throw Error("Advance one period at a time");
        if (next.quarter > g.quarter && remainingClock(g) > 0)
          throw Error("Finish the current period before advancing");
        if (next.quarter > 4 && next.clock > 300)
          throw Error("Overtime is five minutes");
      } else if (b.action === "undo") {
        const a = db
          .prepare(
            "SELECT id,body FROM undo WHERE game=? ORDER BY id DESC LIMIT 1",
          )
          .get(g.id) as { id: number; body: string } | undefined;
        if (!a) throw Error("لا يوجد تعديل للتراجع عنه");
        const old = gameSchema.parse(JSON.parse(a.body));
        if (old.status !== g.status)
          throw Error("Undo is limited to changes within the same status");
        next = { ...old, running: false };
        db.prepare("DELETE FROM undo WHERE id=?").run(a.id);
      } else throw Error("Unknown action");
      if (["score", "clock"].includes(b.action))
        db.prepare("INSERT INTO undo(game,body) VALUES(?,?)").run(
          g.id,
          JSON.stringify({ ...g, clock: remainingClock(g), running: false }),
        );
      if (b.action === "status")
        db.prepare("DELETE FROM undo WHERE game=?").run(g.id);
      next = {
        ...next,
        version: g.version + 1,
        updatedAt: new Date().toISOString(),
      };
      write("games", g.id, next, actor, b.action);
      if (b.action === "correct")
        db.prepare(
          "UPDATE audit SET reason=? WHERE id=(SELECT MAX(id) FROM audit)",
        ).run(b.reason!);
      if (b.action === "correct") {
        const id = crypto.randomUUID();
        write(
          "pulse",
          id,
          {
            id,
            type: "ANNOUNCEMENT",
            game: g.id,
            text: "تصحيح إداري لبيانات المباراة؛ الترتيب وحالة التأهل يعكسان آخر نتيجة معتمدة.",
            date: next.updatedAt,
          },
          actor,
        );
      }
      if (next.status !== g.status && b.action !== "correct") {
        const pulseId = crypto.randomUUID();
        write(
          "pulse",
          pulseId,
          {
            id: pulseId,
            type:
              next.status === "Ended"
                ? "FINAL"
                : next.status === "Live"
                  ? "LIVE"
                  : "ANNOUNCEMENT",
            game: next.id,
            text: `${({ Warmup: "بدء الإحماء", Live: "انطلقت المباراة", Halftime: "استراحة الشوطين", Ended: "انتهت المباراة", Postponed: "تأجيل المباراة", Cancelled: "إلغاء المباراة", Scheduled: "المباراة مجدولة" } as Record<string, string>)[next.status]} · ${get<Team>("teams", next.home)?.name} ${next.status === "Ended" ? next.homeScore + " — " + next.awayScore : "ضد"} ${get<Team>("teams", next.away)?.name}`,
            date: next.updatedAt,
          },
          actor,
        );
      }
      if (next.status === "Ended" && b.action !== "correct") {
        const ts = list<Team>("teams"),
          gs = list<Game>("games"),
          s = settings();
        for (const t of ts) {
          if (
            qualification(t, ts, gs, s) === "QUALIFIED" &&
            qualification(
              t,
              ts,
              gs.map((v) => (v.id === g.id ? g : v)),
              s,
            ) !== "QUALIFIED"
          ) {
            const id = crypto.randomUUID();
            write(
              "pulse",
              id,
              {
                id,
                type: "QUALIFIED",
                team: t.id,
                text: t.name + " · تأهل إلى Elite 16",
                date: next.updatedAt,
              },
              actor,
            );
          }
        }
      }
    })();
    return NextResponse.json({
      ok: true,
      data: {
        settings: settings(),
        teams: list("teams"),
        games: list("games"),
        news: list<{ status: string }>("news").filter(
          (n) => n.status === "published",
        ),
        players: list("players"),
        stats: list("stats"),
        events: list("events"),
        teamStats: list("teamStats"),
        pulse: list("pulse"),
        revision: revision(),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذر حفظ التغيير" },
      { status: e instanceof ConflictError ? 409 : 400 },
    );
  }
}
class ConflictError extends Error {}
export async function GET() {
  const actor = authorize((await cookies()).get("road-session")?.value);
  if (!actor)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = db.prepare("SELECT kind,body FROM records").all() as {
    kind: string;
    body: string;
  }[];
  return NextResponse.json(
    {
      records: records.map((r) => ({
        kind: r.kind,
        value: JSON.parse(r.body),
      })),
      audit: db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 100").all(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
