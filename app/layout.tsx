import type { Metadata } from "next";
import localFont from "next/font/local";
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
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={displayFont.variable}>
      <body>{children}</body>
    </html>
  );
}
