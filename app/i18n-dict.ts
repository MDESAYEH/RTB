import { en as baseEn } from "./i18n-en";
import { clubsEn } from "./i18n-clubs";

/** Server- and client-safe English dictionary (Arabic text → English). */
export const en: Record<string, string> = { ...baseEn, ...clubsEn };
