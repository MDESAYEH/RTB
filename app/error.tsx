"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="system-message">
      <h1>تعذر تحميل بيانات البطولة</h1>
      <p>حاول مجددًا بعد قليل.</p>
      <button onClick={reset}>إعادة المحاولة</button>
    </main>
  );
}
