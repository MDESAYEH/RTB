"use client";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { matchStream, streamEmbed } from "@/lib/stream";

/** Sets the broadcast link of the selected match. Each match has its own link; nothing is shared. */
export function StreamLink({
  game,
  busy,
  lang,
  onSave,
}: {
  game: { id: string; status: string; streamUrl?: string | null };
  busy: boolean;
  lang: "ar" | "en";
  onSave: (link: string) => void;
}) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const saved = game.streamUrl ?? "";
  const [value, setValue] = useState(saved);
  // Follow the stored link when it changes elsewhere (another editor, or right after saving).
  useEffect(() => setValue(saved), [saved, game.id]);
  const trimmed = value.trim();
  const invalid = trimmed !== "" && !streamEmbed(trimmed);
  const showing = matchStream(game).state === "show";
  return (
    <form
      className="admin-card stream-link"
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onSave(trimmed);
      }}
    >
      <h3>
        <Radio size={18} aria-hidden="true" /> {t("بث هذه المباراة", "This match's broadcast")}
      </h3>
      <label>
        {t("رابط البث (YouTube أو Facebook)", "Broadcast link (YouTube or Facebook)")}
        <input
          className="admin-field-ltr"
          dir="ltr"
          inputMode="url"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid}
        />
      </label>
      {invalid && (
        <p className="admin-error" role="alert">
          {t(
            "رابط غير مدعوم. استخدم رابط HTTPS من YouTube أو Facebook.",
            "Unsupported link. Use an HTTPS YouTube or Facebook link.",
          )}
        </p>
      )}
      <div className="stream-link-actions">
        <button className="primary" disabled={busy || invalid || trimmed === saved}>
          {t("حفظ الرابط", "Save link")}
        </button>
        <button type="button" disabled={busy || !saved} onClick={() => onSave("")}>
          {t("إزالة الرابط", "Remove link")}
        </button>
      </div>
      <p className="stream-link-hint">
        {!saved
          ? t(
              "لا يوجد رابط لهذه المباراة. ستظهر في صفحتها عبارة «لم تبدأ المباراة بعد» حتى تبدأ.",
              "No link for this match yet. Its page shows “The match has not started yet” until it starts.",
            )
          : showing
            ? t("البث ظاهر الآن في صفحة المباراة.", "The broadcast is showing on the match page now.")
            : t(
                "الرابط محفوظ، وسيظهر البث تلقائياً في صفحة المباراة عندما تصبح «مباشرة».",
                "The link is saved. The broadcast appears automatically on the match page once the match is live.",
              )}
      </p>
    </form>
  );
}
