/** Factual brief from official article metadata; no copied paragraphs or guessed translation. */
export function automaticNewsDetails(body: unknown) {
  if (typeof body !== "string" || !body.trim()) return undefined;
  const text = body.replace(/\\n/g, " ");
  const scores = [
    ...new Set(text.match(/\b\d{2,3}\s*[–-]\s*\d{2,3}\b/g) ?? []),
  ].slice(0, 8);
  const dates = [
    ...new Set(
      text.match(
        /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/g,
      ) ?? [],
    ),
  ].slice(0, 4);
  const scorers = [
    ...text.matchAll(
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(?:scored|added|contributed|averaged)\s+(\d+(?:\.\d+)?)\s+points\b/g,
    ),
  ].slice(0, 5);
  const records = [...new Set(text.match(/\b\d{1,2}\/\d{1,2}\b/g) ?? [])].slice(
    0,
    5,
  );
  const clubs = [
    ...new Set(
      text.match(
        /\b(?:Johannesburg Giants|Nairobi City Thunder|Al Ahly Benghazi|Dar City|JCA Kings|Al Ittihad|Kriol Star|Stade Malien|Spintex Knights|NPA Pythons|Red Flames)\b/g,
      ) ?? [],
    ),
  ].slice(0, 5);
  const ar: string[] = [],
    en: string[] = [];
  if (clubs.length) {
    ar.push(`أندية يتناولها التقرير: ${clubs.join("، ")}.`);
    en.push(`Clubs covered in this report: ${clubs.join(", ")}.`);
  }
  if (scores.length) {
    ar.push(
      `نتائج مباريات وردت في التقرير: ${scores.join("، ")}. تشير هذه النتائج إلى مباريات مذكورة في المقال، وليست بالضرورة مباريات بطولة طرابلس.`,
    );
    en.push(
      `Match scores mentioned: ${scores.join(", ")}. These belong to fixtures discussed in the article, which may be outside the Tripoli tournament.`,
    );
  }
  if (scorers.length) {
    ar.push(
      "أرقام اللاعبين المذكورة:\n" +
        scorers.map((m) => `• ${m[1]}: ${m[2]} نقطة.`).join("\n"),
    );
    en.push(
      "Player scoring figures reported:\n" +
        scorers.map((m) => `• ${m[1]}: ${m[2]} points.`).join("\n"),
    );
  }
  if (dates.length) {
    ar.push(`تواريخ وردت في الخبر: ${dates.join("، ")}.`);
    en.push(`Dates referenced: ${dates.join(", ")}.`);
  }
  if (records.length) {
    ar.push(`نسب وأرقام وردت في التقرير: ${records.join("، ")}.`);
    en.push(`Fractions mentioned in the report: ${records.join(", ")}.`);
  }
  return ar.length ? { ar: ar.join("\n\n"), en: en.join("\n\n") } : undefined;
}
