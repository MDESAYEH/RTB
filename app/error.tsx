"use client";
import { useLang } from "./i18n";
// retry() re-fetches the segment; reset() would only re-render the failed data.
export default function ErrorPage({ retry }: { retry: () => void }) {
  const { tr } = useLang();
  return (
    <main className="system-message">
      <h1>{tr("تعذر تحميل بيانات البطولة")}</h1>
      <p>{tr("حاول مجددًا بعد قليل.")}</p>
      <button onClick={() => retry()}>{tr("إعادة المحاولة")}</button>
    </main>
  );
}
