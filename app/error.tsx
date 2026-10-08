"use client";
import { useLang } from "./i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { tr } = useLang();
  return (
    <main className="system-message">
      <h1>{tr("تعذر تحميل بيانات البطولة")}</h1>
      <p>{tr("حاول مجددًا بعد قليل.")}</p>
      <button onClick={reset}>{tr("إعادة المحاولة")}</button>
    </main>
  );
}
