"use client";
import { streamEmbed } from "@/lib/stream";
import { useLang } from "./i18n";

/** Live or recorded broadcast: embedded when the platform allows it, otherwise a clear link out. */
export function StreamPlayer({ url }: { url: string | undefined }) {
  const { tr } = useLang();
  const embed = streamEmbed(url);
  if (!embed) return null;
  return (
    <section
      className={`stream-player${embed.label === "Facebook" ? " stream-player-facebook" : ""}`}
      aria-label={tr("البث المباشر")}
    >
      {embed.kind === "iframe" ? (
        <div className="stream-frame">
          <iframe
            src={embed.src}
            title={tr("البث المباشر")}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : null}
      {embed.label === "Facebook" && (
        <p className="stream-mobile-note">
          {tr(
            "قد لا يعمل مشغل فيسبوك داخل متصفح الهاتف؛ افتح البث مباشرة على فيسبوك.",
          )}
        </p>
      )}
      <a
        className="stream-open"
        href={embed.href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {embed.kind === "iframe"
          ? tr("افتح البث في") + " " + embed.label
          : tr("شاهد البث على") + " " + (embed.label || "")}{" "}
        ↗
      </a>
    </section>
  );
}
