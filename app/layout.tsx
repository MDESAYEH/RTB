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
import "@fontsource-variable/cairo/wght.css";
const displayFont = localFont({
  src: "../node_modules/@fontsource-variable/roboto-condensed/files/roboto-condensed-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-display",
  preload: true,
  adjustFontFallback: false,
});
export async function generateMetadata(): Promise<Metadata> {
  const english = (await cookies()).get("lang")?.value === "en";
  return {
    metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
    title: {
      default: english ? "THE ROAD | Tripoli 2027" : "THE ROAD | طرابلس 2027",
      template: "%s | THE ROAD",
    },
    description: english
      ? "Tripoli hosts Africa. An independent platform for the Road to BAL 2027 qualifiers, 21–25 October 2026."
      : "طرابلس تستضيف أفريقيا. منصة مستقلة لتصفيات Road to BAL 2027، 21–25 أكتوبر 2026.",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/Artboard%201-8.png",
      apple: "/Artboard%201-8.png",
    },
    openGraph: {
      title: "TRIPOLI IS THE COURT · ROAD TO BAL 2027",
      description: english
        ? "21–25 October 2026 · Tripoli, Libya"
        : "21–25 أكتوبر 2026 · طرابلس، ليبيا",
      locale: english ? "en_GB" : "ar_LY",
      type: "website",
    },
  };
}
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
