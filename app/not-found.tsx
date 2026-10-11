"use client";
import Link from "next/link";
import { useLang } from "./i18n";
export default function NotFound() {
  const { tr } = useLang();
  return (
    <main className="system-message">
      <h1>{tr("الصفحة غير موجودة")}</h1>
      <Link href="/">{tr("العودة للرئيسية")}</Link>
    </main>
  );
}
