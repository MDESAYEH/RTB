/** Admin sign-in identifier: an email address or an international phone number. */
export type Identifier = { type: "email" | "phone"; value: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Returns the canonical form (lower-case email, `+digits` phone) or null when it is neither. */
export function normalizeIdentifier(raw: unknown): Identifier | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 254) return null;
  if (text.includes("@")) {
    return EMAIL.test(text) ? { type: "email", value: text.toLowerCase() } : null;
  }
  // Phone: international format only, so "0912345678" is rejected rather than guessed.
  let digits = text.replace(/[\s().-]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (!/^\+\d{8,15}$/.test(digits)) return null;
  return { type: "phone", value: digits };
}
