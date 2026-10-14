import { randomBytes, createHash } from "node:crypto";
import { isIP } from "node:net";
import { store, type TournamentStore } from "./store";
export function publicClientKey(req: Request) {
  if (process.env.VERCEL !== "1" && process.env.TRUST_PROXY_IP !== "1")
    return "shared";
  const ip = req.headers.get("x-real-ip") || "";
  if (!isIP(ip)) throw Error("Trusted proxy client address missing");
  return createHash("sha256").update(ip).digest("hex");
}
export async function publicApiLimit(
  req: Request,
  kind: "data" | "live",
  repository: TournamentStore = store,
) {
  let client: string;
  try {
    client = publicClientKey(req);
  } catch {
    return new Response(null, { status: 403 });
  }
  const max = client === "shared" ? 1200 : kind === "data" ? 180 : 60;
  if (!(await repository.rateLimit(`public:${kind}:${client}`, max, 60000)))
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  return null;
}
export async function reserveLive(
  req: Request,
  repository: TournamentStore = store,
) {
  const client = publicClientKey(req),
    id = randomBytes(24).toString("hex");
  await repository.db.exec(
    "CREATE TABLE IF NOT EXISTS public_live_leases(id TEXT PRIMARY KEY,client TEXT NOT NULL,expires INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS public_live_leases_client ON public_live_leases(client);",
  );
  const accepted = await repository.db.transaction(async () => {
    await repository.db
      .prepare("DELETE FROM public_live_leases WHERE expires<=?")
      .run(Date.now());
    const all = (await repository.db
      .prepare("SELECT count(*) AS n FROM public_live_leases")
      .get()) as { n: number };
    const own = (await repository.db
      .prepare("SELECT count(*) AS n FROM public_live_leases WHERE client=?")
      .get(client)) as { n: number };
    if (
      Number(all.n) >= 250 ||
      Number(own.n) >= (client === "shared" ? 250 : 8)
    )
      return false;
    await repository.db
      .prepare("INSERT INTO public_live_leases VALUES(?,?,?)")
      .run(id, client, Date.now() + 255000);
    return true;
  })();
  return accepted
    ? () =>
        repository.db
          .prepare("DELETE FROM public_live_leases WHERE id=?")
          .run(id)
          .then(() => undefined)
    : null;
}
