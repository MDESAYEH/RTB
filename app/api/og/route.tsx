import { ImageResponse } from "next/og";
import { provider } from "@/lib/store";
import { join } from "node:path";
import sharp from "sharp";
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Road to BAL 2027 — Tripoli";
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const path = [query.get("type") || "", query.get("id") || ""];
  const game =
    path[0] === "matches" && path[1] ? await provider.getGame(path[1]) : null;
  const team =
    ["team", "teams"].includes(path[0]) && path[1]
      ? await provider.getTeam(path[1])
      : null;
  const news =
    path[0] === "news"
      ? (await provider.getNews()).find((n) => n.slug === path[1])
      : null;
  const title = game
    ? `${(await provider.getTeam(game.home))?.name} vs ${(await provider.getTeam(game.away))?.name}`
    : team?.name || news?.title || "TRIPOLI IS THE COURT";
  // Pango shapes Arabic correctly; Satori's OpenType subset cannot render this font's GSUB.
  const escape = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const arabic = /[\u0600-\u06ff]/.test(title)
    ? await sharp({
        text: {
          text: '<span foreground="#f5f7fa">' + escape(title) + "</span>",
          fontfile: join(process.cwd(), "assets/Arabic-Bold.woff"),
          font: "Noto Sans Arabic Bold",
          width: 1060,
          height: 170,
          rgba: true,
          align: "right",
        },
      })
        .png()
        .toBuffer()
    : null;
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#07111f",
          color: "#f5f7fa",
          padding: 70,
          fontFamily: "sans-serif",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#ff5a1f",
            letterSpacing: 5,
          }}
        >
          THE ROAD / TRIPOLI
        </div>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 35 ? 56 : 76,
            fontWeight: 900,
            lineHeight: 1.15,
          }}
        >
          {arabic ? (
            <img
              src={"data:image/png;base64," + arabic.toString("base64")}
              alt={title}
              style={{
                objectFit: "contain",
                objectPosition: "right",
                width: 1060,
                height: 170,
              }}
            />
          ) : (
            title
          )}
        </div>
        {game && ["Live", "Halftime", "Ended"].includes(game.status) && (
          <div style={{ display: "flex", fontSize: 70, color: "#ff5a1f" }}>
            {game.homeScore} — {game.awayScore} ·{" "}
            {game.status === "Ended" ? "FINAL" : "LAST CONFIRMED"}
          </div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            fontSize: 28,
          }}
        >
          <div>ROAD TO BAL 2027</div>
          <div style={{ display: "flex", color: "#a7b5c5" }}>
            21–25 OCTOBER 2026 · TRIPOLI, LIBYA
          </div>
        </div>
      </div>
    ),
    size,
  );
}
