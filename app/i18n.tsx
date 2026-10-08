"use client";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./i18n-dict";

export type Lang = "ar" | "en";
type Ctx = {
  lang: Lang;
  dir: "rtl" | "ltr";
  tr: (arabic: string) => string;
  toggle: () => void;
};
const LangContext = createContext<Ctx>({
  lang: "ar",
  dir: "rtl",
  tr: (arabic) => arabic,
  toggle: () => {},
});

/** Arabic is the source language; English comes from the dictionary and falls back to Arabic. */
export function LangProvider({
  initial,
  children,
}: {
  initial: Lang;
  children: ReactNode;
}) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initial);
  const toggle = useCallback(() => {
    const next: Lang = lang === "ar" ? "en" : "ar";
    setLang(next);
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
    router.refresh();
  }, [lang, router]);
  const value = useMemo<Ctx>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      tr: (arabic) => (lang === "en" ? (en[arabic] ?? arabic) : arabic),
      toggle,
    }),
    [lang, toggle],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}
export const useLang = () => useContext(LangContext);

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, toggle } = useLang();
  return (
    <button
      type="button"
      className={"lang-toggle " + className}
      onClick={toggle}
      lang={lang === "ar" ? "en" : "ar"}
      aria-label={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      {lang === "ar" ? "EN" : "عربي"}
    </button>
  );
}
