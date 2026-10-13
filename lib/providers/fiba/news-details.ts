import type { News } from "../../domain";
/** Reviewed paraphrases of current FIBA reports. Never republish their full article text. */
const details: Record<string, { evidence: string[]; ar: string; en: string }> =
  {
    "giants-win-back-to-back-south-african-titles": {
      evidence: ["99-57", "Whitbread", "Mahlong"],
      ar: "توّج جوهانسبرغ جاينتس ببطولة الأندية الوطنية في جنوب أفريقيا للمرة الثانية تواليًا، وأنهى المنافسة بأربعة انتصارات دون خسارة. اختتم الفريق مشواره يوم 11 أكتوبر في جوهانسبرغ بالفوز على MBB بنتيجة 99–57، ليحجز مقعد جنوب أفريقيا في تصفيات Road to BAL 2027.\n\nسجل ديلان ويتبريد 20 نقطة، وأضاف جوشوا أوزابور 19 نقطة. وساهم أفيوي ماهلونغ، أفضل لاعب في البطولة، بـ15 نقطة، بينما سجل يانيك كاسيليمبو 12 نقطة.\n\nقبل المباراة الأخيرة، فاز جاينتس على جوزي ناغتس 61–60، وأكاديمية سويتو 95–49، وDUEP بنتيجة 63–59. ويستعد الفريق للعودة إلى التصفيات بعد مشاركته الأولى في BAL.",
      en: "Johannesburg Giants retained South Africa’s national club championship after winning all four games. Their final fixture on 11 October ended in a 99–57 victory over MBB, securing the country’s place in the 2027 Road to BAL qualifiers.\n\nDylan Whitbread contributed 20 points and Joshua Ozabor 19. Tournament MVP Aviwe Mahlong added 15, with Yanick Kasilembo scoring 12.\n\nEarlier victories came against Jozi Nuggets (61–60), Soweto Basketball Academy (95–49) and DUEP (63–59). The Giants now turn their attention to another continental qualification campaign.",
    },
    "nairobi-city-thunder-win-three-peat-in-kenya": {
      evidence: ["90-0", "74-70", "Ongwae"],
      ar: "حصد نيروبي سيتي ثاندر لقب الدوري الكيني للمرة الثالثة تواليًا دون خسارة، ووصل إلى سلسلة من 90 انتصارًا. حسم الفريق نهائي الأدوار الإقصائية أمام هيئة موانئ كينيا بثلاثة انتصارات مقابل لا شيء.\n\nفاز ثاندر بالمباراة الأولى 78–67 بعد وقت إضافي، ثم بالثانية 72–63. وفي المباراة الثالثة يوم 2 أكتوبر، أنهى السلسلة بفوز 74–70 في قاعة كاساراني.\n\nنال ديريك أوغيشي جائزة أفضل لاعب في الموسم المنتظم، وفاز تايلر أونغواي بجائزة أفضل لاعب في الأدوار الإقصائية. وحصل برادلي إبس على جائزة أفضل مدرب. ويعود الفريق إلى Road to BAL للمرة الثالثة.",
      en: "Nairobi City Thunder earned a third straight Kenyan league championship, extending their unbeaten sequence to 90 games. They swept Kenya Ports Authority 3–0 in the playoff final.\n\nThe opening win came in overtime, 78–67, followed by a 72–63 victory. A 74–70 result at Kasarani on 2 October completed the series.\n\nDerrick Ogechi received the regular-season MVP award, Tyler Ongwae the playoff MVP honour, and Bradley Ibs the coaching award. Thunder qualified for another Road to BAL campaign.",
    },
    "introducing-the-road-to-bal-2027": {
      evidence: ["Tripoli", "October 21", "Elite 16"],
      ar: "تبدأ تصفيات Road to BAL 2027 يوم 21 أكتوبر، وتضم أكثر من عشرين فريقًا موزعين على منطقتي الشرق والغرب. تتأهل الفرق عبر مرحلة المجموعات إلى منافسات Elite 16.\n\nتستضيف طرابلس المجموعتين A وB من 21 إلى 25 أكتوبر. تضم الأولى الاتحاد، وستاد ماليان، وستاولي، ونابايا، وكريول ستار. وتضم الثانية إنرجي، والجمارك، وسبينتكس نايتس، وإن بي إيه بايثونز، وريد فليمز. ويتأهل أول فريقين من كل مجموعة.\n\nتقام مجموعات أخرى في برازافيل وهوِيما ولوساكا. وتستضيف أبيدجان ونيروبي الدور الحاسم، مع احتمال استخدام بطاقات دعوة لاستكمال فرق Elite 16.",
      en: "The 2027 Road to BAL qualification campaign begins on 21 October, with over twenty clubs divided between East and West. Group-stage qualifiers advance to the Elite 16.\n\nTripoli hosts Groups A and B from 21–25 October. Group A includes Al Ittihad, Stade Malien, Staoueli, Nabaya and Kriol Star; Group B includes Energie, AS Douanes, Spintex Knights, NPA Pythons and Red Flames. Two clubs advance from each group.\n\nOther groups play in Brazzaville, Hoima and Lusaka. Abidjan and Nairobi host the decisive stage; wild cards may complete its field.",
    },
    "what-happened-on-the-road-to-bal-tournament-last-year": {
      evidence: ["Twenty-two", "105", "Dar City"],
      ar: "استعرضت FIBA النسخة السابقة من تصفيات BAL، التي شارك فيها 22 ناديًا من 22 دولة، وأقيمت منافساتها في سبع مدن أفريقية.\n\nبرز نيروبي سيتي ثاندر وجوهانسبرغ جاينتس في المنطقة الشرقية، بينما أنهى الأهلي بنغازي مشواره دون خسارة، وفاز على JCA Kings بنتيجة 105–92. وأصبح دار سيتي أول فريق تنزاني يتأهل إلى BAL.\n\nمن أبرز مفاجآت التصفيات فوز جاينتس على دار سيتي 71–69، ليضمن مشاركته الأولى. وفي موسم BAL 2026، وصل دار سيتي إلى الأدوار الإقصائية، وكان الأهلي بنغازي الأكثر نجاحًا بين الفرق القادمة من التصفيات، إذ أنهى البطولة في المركز الثالث.",
      en: "FIBA’s retrospective covers a qualifying edition involving 22 clubs from 22 countries across seven host cities.\n\nNairobi City Thunder and Johannesburg Giants stood out in the East. Al Ahly Benghazi completed an unbeaten campaign, beating JCA Kings 105–92. Dar City became Tanzania’s first BAL representative.\n\nA 71–69 Giants victory over Dar City was a notable upset that secured their debut. In the 2026 BAL season, Dar City reached the playoffs, while Al Ahly Benghazi finished third, the strongest result among the qualifying clubs.",
    },
  };
export function reviewedNewsDetails(slug: string, body: unknown) {
  const entry = details[slug];
  return entry &&
    typeof body === "string" &&
    entry.evidence.every((v) => body.includes(v))
    ? entry
    : undefined;
}

/** Backfill already imported official records while their next sync is pending. */
const arabicTitles: Record<string,string> = {
  "giants-win-back-to-back-south-african-titles": "جوهانسبرغ جاينتس يتوّج ببطولة جنوب أفريقيا للمرة الثانية تواليًا",
  "nairobi-city-thunder-win-three-peat-in-kenya": "نيروبي سيتي ثاندر يحقق لقب الدوري الكيني للمرة الثالثة تواليًا",
  "introducing-the-road-to-bal-2027": "تعرّف على بطولة الطريق إلى BAL 2027",
  "what-happened-on-the-road-to-bal-tournament-last-year": "ماذا حدث في بطولة الطريق إلى BAL العام الماضي؟",
};
export function arabicNewsTitle(slug:string, original:string) { return arabicTitles[slug] ?? original; }
export function importedNewsDetails(news: News): News {
  if (!news.sourceUrl) return news;
  let source: URL;
  try { source = new URL(news.sourceUrl); } catch { return news; }
  if (source.origin !== "https://www.fiba.basketball") return news;
  const slug = source.pathname.split("/").pop() ?? "";
  news = {...news,title:arabicNewsTitle(slug,news.title),titleEn:news.titleEn || news.title};
  if (news.content !== news.excerpt) return news;
  const entry = details[slug];
  if (!entry) return news;
  return {...news,content:entry.ar,contentEn:entry.en};
}
