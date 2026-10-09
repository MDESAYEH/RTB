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
    if (/\/videos\/\d+|\/watch\/?$|\/reel\/\d+/.test(url.pathname))
      return {
        kind: "iframe",
        src:
          "https://www.facebook.com/plugins/video.php?show_text=false&href=" +
          encodeURIComponent(url.toString()),
        href: url.toString(),
        label: "Facebook",
      };
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
