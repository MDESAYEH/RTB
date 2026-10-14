"use client";
import { useLang } from "./i18n";

export type LegalPage = "privacy" | "terms" | "accessibility";
type Bi = [string, string];
type Section = { h: Bi; p?: Bi; items?: Bi[] };
type Doc = { eyebrow: Bi; title: Bi; lead: Bi; sections: Section[] };

const UPDATED: Bi = ["آخر تحديث: 14 أكتوبر 2026", "Last updated: 14 October 2026"];

const docs: Record<LegalPage, Doc> = {
  privacy: {
    eyebrow: ["بياناتك", "Your data"],
    title: ["سياسة الخصوصية", "Privacy policy"],
    lead: [
      "نوضح هنا ما الذي يُخزَّن عند زيارتك لموقع Road to BAL – طرابلس 2027، ولماذا، وما الذي لا نفعله.",
      "This page explains what is stored when you visit the Road to BAL – Tripoli 2027 website, why, and what we do not do.",
    ],
    sections: [
      {
        h: ["الموقع وغرضه", "About this website"],
        p: [
          "هذا الموقع مخصص لعرض معلومات التصفيات التمهيدية للدوري الإفريقي لكرة السلة BAL 2027 في طرابلس (21–25 أكتوبر 2026): المباريات والنتائج والترتيب والفرق والأخبار والإحصائيات.",
          "This website presents information about the BAL 2027 qualifiers in Tripoli (21–25 October 2026): fixtures, results, standings, teams, news and statistics.",
        ],
      },
      {
        h: ["ما الذي نجمعه", "What we collect"],
        p: [
          "لا نطلب من الزوار إنشاء حساب ولا نجمع بيانات شخصية عبر نماذج. ما يتم تخزينه تلقائياً هو التالي فقط:",
          "Visitors do not need an account and we do not collect personal data through forms. Only the following is stored automatically:",
        ],
        items: [
          [
            "ملف تعريف ارتباط (cookie) باسم lang لتذكّر لغة العرض (العربية أو الإنجليزية)، ويبقى لمدة سنة.",
            "A cookie named lang that remembers your display language (Arabic or English) for one year.",
          ],
          [
            "سجلات الخادم التقنية (عنوان IP ونوع المتصفح والصفحة المطلوبة ووقت الطلب) لحماية الموقع من الإساءة وضمان استقراره.",
            "Standard server logs (IP address, browser type, requested page and time) used to protect the site from abuse and keep it stable.",
          ],
          [
            "ملف جلسة خاص بفريق التنظيم المصرّح له فقط عند تسجيل دخوله إلى لوحة الإدارة. لا يُنشأ للزوار.",
            "A session cookie for authorised organisers signing in to the admin area only. It is never created for visitors.",
          ],
        ],
      },
      {
        h: ["ما الذي لا نفعله", "What we do not do"],
        p: [
          "لا نستخدم أدوات تحليلات أو إعلانات أو تتبّع عبر المواقع، ولا نبيع بياناتك ولا نشاركها لأغراض تسويقية.",
          "We do not use analytics, advertising or cross-site tracking tools, and we do not sell or share your data for marketing.",
        ],
      },
      {
        h: ["محتوى من أطراف خارجية", "Third-party content"],
        p: [
          "قد تعرض بعض الصفحات بثاً مباشراً من YouTube (عبر نطاق youtube-nocookie) أو محتوى مضمّناً من Facebook، وتُحمَّل شعارات وصور من مواقع FIBA. عند عرض هذا المحتوى تتلقى تلك الجهات عنوان IP الخاص بك وتخضع لسياسات الخصوصية الخاصة بها.",
          "Some pages may show a live stream from YouTube (via the youtube-nocookie domain) or embedded Facebook content, and load logos and images from FIBA sites. When this content is displayed those providers receive your IP address and are governed by their own privacy policies.",
        ],
      },
      {
        h: ["مدة الاحتفاظ", "Retention"],
        p: [
          "تُحفظ سجلات الخادم لمدة محدودة بحسب إعدادات الخادم، ويُحذف ملف اللغة تلقائياً بعد سنة أو عند مسحه من متصفحك.",
          "Server logs are kept for a limited period according to the server configuration; the language cookie expires after a year or when you clear it from your browser.",
        ],
      },
      {
        h: ["حقوقك والتواصل", "Your rights and contact"],
        p: [
          "يمكنك في أي وقت حذف ملفات الارتباط من إعدادات متصفحك. لأي استفسار يتعلق بالخصوصية يرجى التواصل مع اللجنة المنظمة عبر قنوات التواصل الرسمية للبطولة.",
          "You can delete cookies at any time in your browser settings. For privacy questions please contact the organising committee through the tournament's official channels.",
        ],
      },
      {
        h: ["تحديث هذه السياسة", "Changes to this policy"],
        p: [
          "قد نحدّث هذه الصفحة عند تغيّر طريقة عمل الموقع، ويظهر تاريخ آخر تحديث في أعلى الصفحة.",
          "We may update this page when the way the site works changes; the date of the latest update is shown at the top.",
        ],
      },
    ],
  },
  terms: {
    eyebrow: ["قواعد الاستخدام", "Rules of use"],
    title: ["الشروط والأحكام", "Terms and conditions"],
    lead: [
      "باستخدامك هذا الموقع فإنك توافق على الشروط التالية.",
      "By using this website you agree to the following terms.",
    ],
    sections: [
      {
        h: ["طبيعة المعلومات", "Nature of the information"],
        p: [
          "نعرض المباريات والنتائج والترتيب والأخبار بغرض الإعلام. يتم تحديث جزء من البيانات تلقائياً من الصفحات العامة للاتحاد الدولي لكرة السلة (FIBA) ومن إدخال اللجنة المنظمة، وقد يحدث تأخير أو خطأ. المرجع الرسمي هو ما يعلنه FIBA واللجنة المنظمة.",
          "We show fixtures, results, standings and news for information only. Part of the data is updated automatically from FIBA's public pages and entered by the organising committee, so delays or errors may occur. The official reference is what FIBA and the organising committee announce.",
        ],
      },
      {
        h: ["الملكية الفكرية", "Intellectual property"],
        p: [
          "الشعارات والأسماء التجارية، ومنها FIBA وFIBA Africa وBAL وشعارات الأندية والجهات الراعية، ملك لأصحابها وتُعرض للتعريف بالحدث فقط. لا يجوز إعادة استخدامها دون إذن من أصحابها.",
          "Logos and trademarks, including FIBA, FIBA Africa, BAL and the clubs' and sponsors' marks, belong to their respective owners and are shown only to identify the event. They may not be reused without their owners' permission.",
        ],
      },
      {
        h: ["الاستخدام المقبول", "Acceptable use"],
        p: ["يُمنع:", "You must not:"],
        items: [
          [
            "محاولة الدخول إلى لوحة الإدارة أو إلى بيانات غير متاحة للعموم.",
            "attempt to access the admin area or non-public data;",
          ],
          [
            "تعطيل الموقع أو إغراقه بالطلبات أو استخدام أدوات آلية بشكل يضر بأدائه.",
            "disrupt the site, flood it with requests or use automated tools in a way that harms its performance;",
          ],
          [
            "استخدام محتوى الموقع بصورة مضللة أو نسبته لجهة غير مصدره.",
            "use the site's content in a misleading way or attribute it to someone other than its source.",
          ],
        ],
      },
      {
        h: ["الروابط والمحتوى الخارجي", "Links and external content"],
        p: [
          "قد يحتوي الموقع على روابط أو محتوى مضمّن من مواقع أخرى (مثل FIBA وYouTube وFacebook). لسنا مسؤولين عن محتواها أو سياساتها.",
          "The site may contain links or embedded content from other sites (such as FIBA, YouTube and Facebook). We are not responsible for their content or policies.",
        ],
      },
      {
        h: ["إخلاء المسؤولية", "Disclaimer"],
        p: [
          "يُقدَّم الموقع كما هو دون ضمانات بالتوفر المستمر أو خلوّه التام من الأخطاء، ولا تتحمل اللجنة المنظمة مسؤولية قرارات تُتخذ بالاعتماد على معلومات الموقع وحدها.",
          "The site is provided as is, without guarantees of uninterrupted availability or of being error-free, and the organising committee is not liable for decisions made relying on the site alone.",
        ],
      },
      {
        h: ["التعديل والقانون المطبّق", "Changes and governing law"],
        p: [
          "يجوز تعديل هذه الشروط في أي وقت، ويعد استمرارك في استخدام الموقع موافقة على النسخة المحدّثة. تخضع هذه الشروط للقوانين المعمول بها في دولة ليبيا.",
          "These terms may be changed at any time, and continued use of the site means you accept the updated version. These terms are governed by the laws in force in Libya.",
        ],
      },
    ],
  },
  accessibility: {
    eyebrow: ["للجميع", "For everyone"],
    title: ["إمكانية الوصول", "Accessibility"],
    lead: [
      "نريد أن يتمكن كل المشجعين من متابعة البطولة بسهولة، ونعمل على تحسين الموقع باستمرار.",
      "We want every fan to be able to follow the tournament easily, and we keep improving the site.",
    ],
    sections: [
      {
        h: ["ما نعتمده في التصميم", "What the design provides"],
        items: [
          [
            "واجهة بلغتين: العربية (من اليمين إلى اليسار) والإنجليزية (من اليسار إلى اليمين).",
            "Two languages: Arabic (right-to-left) and English (left-to-right).",
          ],
          [
            "تصميم متجاوب يعمل على الهاتف والجهاز اللوحي والحاسوب.",
            "A responsive layout for phones, tablets and desktops.",
          ],
          [
            "هيكل صفحات واضح بعناوين، وعناصر قابلة للتنقل بلوحة المفاتيح.",
            "A clear page structure with headings, and keyboard-navigable controls.",
          ],
          [
            "نصوص بديلة للصور والشعارات، وألوان بتباين مناسب للنصوص الأساسية.",
            "Text alternatives for images and logos, and sufficient colour contrast for the main text.",
          ],
        ],
      },
      {
        h: ["قيود معروفة", "Known limitations"],
        items: [
          [
            "البث المباشر والمحتوى المضمّن من أطراف خارجية (YouTube وFacebook) تتحكم بإتاحته تلك الجهات.",
            "The live stream and embedded third-party content (YouTube, Facebook) are accessible only to the extent those providers allow.",
          ],
          [
            "رادار THE ROAD عنصر بصري بالأساس؛ تتوفر المعلومات نفسها كنص في البطاقة المجاورة وفي قائمة المحطات.",
            "The THE ROAD radar is mainly visual; the same information is available as text in the adjacent card and in the stage list.",
          ],
        ],
      },
      {
        h: ["نصائح للقراءة", "Reading tips"],
        p: [
          "يمكنك تكبير النص عبر إعدادات المتصفح (Ctrl و+) دون أن يتعطل التصميم، وتبديل اللغة من الزر في أعلى الصفحة.",
          "You can enlarge text with your browser's zoom (Ctrl and +) without breaking the layout, and switch language from the button at the top of the page.",
        ],
      },
      {
        h: ["ملاحظاتك", "Feedback"],
        p: [
          "إذا واجهت صعوبة في الوصول إلى أي جزء من الموقع، يرجى إبلاغ اللجنة المنظمة عبر قنوات التواصل الرسمية للبطولة مع ذكر الصفحة والمشكلة، وسنسعى لمعالجتها.",
          "If you have trouble using any part of the site, please tell the organising committee through the tournament's official channels, naming the page and the problem, and we will work to fix it.",
        ],
      },
    ],
  },
};

export function LegalContent({ page }: { page: LegalPage }) {
  const { lang } = useLang();
  const i = lang === "ar" ? 0 : 1;
  const doc = docs[page];
  return (
    <div className="legal-design">
      <header className="legal-banner">
        <small>{doc.eyebrow[i]}</small>
        <h1>{doc.title[i]}</h1>
        <p>{doc.lead[i]}</p>
      </header>
      <div className="legal-body">
        <p className="legal-updated">{UPDATED[i]}</p>
        {doc.sections.map((s) => (
          <section className="legal-section" key={s.h[0]}>
            <h2>{s.h[i]}</h2>
            {s.p && <p>{s.p[i]}</p>}
            {s.items && (
              <ul>
                {s.items.map((it) => (
                  <li key={it[0]}>{it[i]}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
