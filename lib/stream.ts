/** Turns an editor-supplied stream link into something the public site can safely show. */
export type StreamEmbed =
  | { kind: "iframe"; src: string; href: string; label: "Facebook" | "YouTube" }
  | { kind: "link"; href: string; label: "Facebook" | "YouTube" | "" };

const FACEBOOK = /^(www\.|web\.|m\.)?facebook\.com$/;
const YOUTUBE = /^(www\.|m\.)?youtube\.com$/;

export function streamEmbed(raw: string | undefined | null): StreamEmbed | null {
  const value = (raw || "").trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (FACEBOOK.test(host)) {
    // /share/v/... links can't be embedded; Facebook only embeds the canonical video URL.
    if (/^\/share\//.test(url.pathname))
      return { kind: "link", href: url.toString(), label: "Facebook" };
    if (/\/videos\/\d+|\/watch\/?$|\/reel\/\d+/.test(url.pathname)) {
      // A reel is vertical: ask Facebook for a portrait player so the picture fills the frame.
      const reel = /\/reel\/\d+/.test(url.pathname);
      return {
        kind: "iframe",
        src:
          `https://www.facebook.com/plugins/video.php?show_text=false&width=${reel ? 360 : 560}&height=${reel ? 640 : 315}&href=` +
          encodeURIComponent(url.toString()),
        href: url.toString(),
        label: "Facebook",
      };
    }
    return { kind: "link", href: url.toString(), label: "Facebook" };
  }
  if (host === "fb.watch")
    return { kind: "link", href: url.toString(), label: "Facebook" };
  let id = "";
  if (YOUTUBE.test(host)) {
    id =
      url.searchParams.get("v") ||
      url.pathname.match(/^\/(?:live|embed)\/([\w-]{6,})/)?.[1] ||
      "";
  } else if (host === "youtu.be") id = url.pathname.slice(1);
  if (/^[\w-]{6,}$/.test(id))
    return {
      kind: "iframe",
      src: "https://www.youtube-nocookie.com/embed/" + id,
      href: url.toString(),
      label: "YouTube",
    };
  return null;
}

/** An HTTPS link straight to a video file (MP4 / WebM), played by the browser itself. */
export function directVideo(raw: string | undefined | null): string | null {
  try {
    const url = new URL((raw || "").trim());
    return url.protocol === "https:" && /.(mp4|webm|mov|m4v)$/i.test(url.pathname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export type BroadcastState =
  | "show" // the match has its own link and is on (or finished): embed it
  | "not-started" // scheduled or warming up: placeholder until it goes live
  | "no-link" // live, but the organisers have not published a link
  | "ended" // finished with no recording link
  | "postponed"
  | "cancelled";

/**
 * What a match page should show. Every match has its own `streamUrl`; there is no shared stream.
 * A link entered ahead of time stays hidden until the match is live, then appears on its own.
 */
export function matchStream(game: {
  status: string;
  streamUrl?: string | null;
}): { state: BroadcastState; url?: string } {
  const hasLink = !!streamEmbed(game.streamUrl);
  switch (game.status) {
    case "Live":
    case "Halftime":
      return hasLink
        ? { state: "show", url: game.streamUrl ?? undefined }
        : { state: "no-link" };
    case "Ended":
      return hasLink
        ? { state: "show", url: game.streamUrl ?? undefined }
        : { state: "ended" };
    case "Postponed":
      return { state: "postponed" };
    case "Cancelled":
      return { state: "cancelled" };
    default:
      return { state: "not-started" };
  }
}

/** Placeholder text shown where the player would be. */
export function broadcastPlaceholder(
  state: BroadcastState,
  lang: "ar" | "en",
): { title: string; body: string } {
  const text: Record<Exclude<BroadcastState, "show">, [string, string, string, string]> = {
    "not-started": [
      "لم تبدأ المباراة بعد",
      "The match has not started yet",
      "سيظهر البث هنا فور انطلاق المباراة.",
      "The broadcast will appear here as soon as the match starts.",
    ],
    "no-link": [
      "البث غير متاح لهذه المباراة",
      "No broadcast for this match",
      "لم تنشر الإدارة رابط بث لهذه المباراة بعد.",
      "The organisers have not published a broadcast link for this match yet.",
    ],
    ended: [
      "انتهت المباراة",
      "The match has ended",
      "لا يتوفر تسجيل لهذه المباراة حالياً.",
      "No recording is available for this match at the moment.",
    ],
    postponed: [
      "تأجلت المباراة",
      "The match was postponed",
      "سيُعلن الموعد الجديد فور اعتماده.",
      "The new date will be announced once confirmed.",
    ],
    cancelled: [
      "أُلغيت المباراة",
      "The match was cancelled",
      "لن يُنقل بث لهذه المباراة.",
      "There will be no broadcast for this match.",
    ],
  };
  if (state === "show") return { title: "", body: "" };
  const row = text[state];
  return lang === "ar" ? { title: row[0], body: row[2] } : { title: row[1], body: row[3] };
}
