import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { LangProvider, type Lang } from "./i18n";
import "./globals.css";
import "./tournament-campaign.css";
import "./editorial-club.css";
import "./sports-utility.css";
import "./basketball-loading.css";
import "./home-hero.css";
import "./african-pattern.css";
import "@fontsource-variable/noto-sans-arabic/wght.css";
const displayFont = localFont({
  src: "../node_modules/@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
  variable: "--font-display",
  preload: true,
  adjustFontFallback: false,
});
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: { default: "THE ROAD | طرابلس 2027", template: "%s | THE ROAD" },
  description:
    "طرابلس تستضيف أفريقيا. منصة مستقلة لتصفيات Road to BAL 2027، 21–25 أكتوبر 2026.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/Artboard%201-8.png",
    apple: "/Artboard%201-8.png",
  },
  openGraph: {
    title: "TRIPOLI IS THE COURT · ROAD TO BAL 2027",
    description: "21–25 أكتوبر 2026 · طرابلس، ليبيا",
    locale: "ar_LY",
    type: "website",
  },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const lang: Lang = (await cookies()).get("lang")?.value === "en" ? "en" : "ar";
  return (
    <html
      lang={lang}
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={displayFont.variable}
    >
      <body>
        <LangProvider initial={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
