"use client";
import { useLang } from "./i18n";

export type LegalPage = "privacy" | "terms" | "accessibility";
type Bi = [string, string];
type Section = { h: Bi; p?: Bi[]; items?: Bi[] };
type Doc = { eyebrow: Bi; title: Bi; lead: Bi; sections: Section[] };

const UPDATED: Bi = ["آخر تحديث: 14 أكتوبر 2026", "Last updated: 14 October 2026"];

const docs: Record<LegalPage, Doc> = {
  privacy: {
    eyebrow: ["خصوصيتك تهمنا", "Your privacy matters"],
    title: ["سياسة الخصوصية", "Privacy policy"],
    lead: [
      "توضح هذه السياسة كيف نتعامل مع المعلومات المرتبطة باستخدامك لهذا الموقع، وما الخيارات المتاحة لك.",
      "This policy explains how we handle information connected to your use of this website, and the choices available to you.",
    ],
    sections: [
      {
        h: ["نطاق السياسة", "Scope of this policy"],
        p: [
          [
            "تنطبق هذه السياسة على هذا الموقع وعلى الخدمات والمحتوى المتاح من خلاله. باستخدامك الموقع فإنك تقرّ بأنك اطلعت على هذه السياسة وفهمتها.",
            "This policy applies to this website and to the services and content offered through it. By using the website you acknowledge that you have read and understood it.",
          ],
        ],
      },
      {
        h: ["المعلومات التي نجمعها", "Information we collect"],
        p: [
          [
            "نحرص على جمع أقل قدر ممكن من المعلومات اللازمة لتشغيل الموقع وحمايته وتحسينه. وقد يشمل ذلك:",
            "We aim to collect only the information needed to operate, protect and improve the website. This may include:",
          ],
        ],
        items: [
          [
            "معلومات تقنية تُرسَل تلقائياً عند الزيارة، مثل عنوان IP ونوع المتصفح والجهاز ولغة العرض والصفحات المطلوبة ووقت الطلب.",
            "Technical information sent automatically when you visit, such as IP address, browser and device type, display language, requested pages and request time.",
          ],
          [
            "تفضيلات العرض التي تختارها، مثل اللغة، لتسهيل زياراتك اللاحقة.",
            "Display preferences you choose, such as language, to make later visits easier.",
          ],
          [
            "المعلومات التي تقدمها لنا طوعاً عند التواصل معنا.",
            "Information you choose to provide when you contact us.",
          ],
        ],
      },
      {
        h: ["كيف نستخدم المعلومات", "How we use information"],
        items: [
          [
            "تشغيل الموقع وتقديم محتواه وخدماته بشكل سليم.",
            "To operate the website and deliver its content and services properly.",
          ],
          [
            "حماية الموقع ومستخدميه من إساءة الاستخدام والاختراق ومحاولات التلاعب.",
            "To protect the website and its users from misuse, intrusion and manipulation.",
          ],
          [
            "فهم أداء الموقع وتحسين تجربة الاستخدام وإصلاح الأعطال.",
            "To understand site performance, improve the experience and fix faults.",
          ],
          [
            "الرد على استفساراتك والوفاء بالتزاماتنا النظامية عند الاقتضاء.",
            "To respond to your enquiries and meet our legal obligations where required.",
          ],
        ],
      },
      {
        h: ["ملفات تعريف الارتباط والتقنيات المشابهة", "Cookies and similar technologies"],
        p: [
          [
            "قد يستخدم الموقع ملفات تعريف الارتباط (Cookies) وتقنيات مشابهة لتذكّر تفضيلاتك ولأغراض الأمان وتشغيل الموقع. يمكنك التحكم في هذه الملفات أو حذفها من إعدادات المتصفح، وقد تتأثر بعض الميزات إذا عطّلتها.",
            "The website may use cookies and similar technologies to remember your preferences and for security and operational purposes. You can control or delete them in your browser settings, although some features may be affected if you disable them.",
          ],
        ],
      },
      {
        h: ["خدمات ومحتوى من أطراف ثالثة", "Third-party services and content"],
        p: [
          [
            "قد يعرض الموقع محتوى أو يعتمد على خدمات من جهات أخرى، مثل مقاطع الفيديو والبث والمنصات الاجتماعية والصور والخطوط. عند تحميل هذا المحتوى قد تتلقى تلك الجهات معلومات تقنية عنك، مثل عنوان IP، وتخضع لسياسات الخصوصية الخاصة بها، ونوصيك بالاطلاع عليها.",
            "The website may display content or rely on services from other parties, such as video and live streams, social platforms, images and fonts. When this content loads, those parties may receive technical information about you, such as your IP address, and are governed by their own privacy policies, which we encourage you to review.",
          ],
        ],
      },
      {
        h: ["مشاركة المعلومات", "Sharing of information"],
        p: [
          [
            "لا نبيع معلوماتك الشخصية ولا نؤجّرها. وقد نشاركها فقط مع مزوّدي الخدمات الذين يساعدوننا في تشغيل الموقع وفق التزامات سرية مناسبة، أو عندما يوجب ذلك القانون أو أمر جهة مختصة، أو لحماية حقوقنا وأمن الموقع ومستخدميه.",
            "We do not sell or rent your personal information. We may share it only with service providers who help us run the website under appropriate confidentiality obligations, where required by law or by a competent authority, or to protect our rights and the security of the website and its users.",
          ],
        ],
      },
      {
        h: ["أمن المعلومات", "Information security"],
        p: [
          [
            "نطبّق إجراءات تقنية وتنظيمية معقولة لحماية المعلومات من الوصول غير المصرّح به أو الفقدان أو التعديل، ونقصر الوصول على من يحتاجه فعلاً. ومع ذلك لا توجد وسيلة نقل أو تخزين إلكتروني آمنة بالكامل، لذلك لا يمكننا ضمان أمان مطلق.",
            "We apply reasonable technical and organisational measures to protect information against unauthorised access, loss or alteration, and we limit access to those who need it. However, no method of electronic transmission or storage is completely secure, so we cannot guarantee absolute security.",
          ],
        ],
      },
      {
        h: ["مدة الاحتفاظ", "Retention"],
        p: [
          [
            "نحتفظ بالمعلومات للمدة اللازمة لتحقيق الأغراض الموضحة في هذه السياسة أو بحسب ما يقتضيه القانون، ثم نحذفها أو نجعلها مجهولة الهوية.",
            "We keep information for as long as needed for the purposes described in this policy or as required by law, and then delete or anonymise it.",
          ],
        ],
      },
      {
        h: ["خياراتك وحقوقك", "Your choices and rights"],
        p: [
          [
            "يمكنك في أي وقت إدارة ملفات تعريف الارتباط من متصفحك، وطلب الاطلاع على المعلومات التي نحتفظ بها عنك أو تصحيحها أو حذفها، وذلك وفق الأنظمة المعمول بها.",
            "You may at any time manage cookies from your browser and ask to access, correct or delete the information we hold about you, in line with applicable law.",
          ],
        ],
      },
      {
        h: ["خصوصية الأطفال", "Children's privacy"],
        p: [
          [
            "الموقع غير موجّه للأطفال، ولا نجمع عمداً معلومات شخصية منهم. وإذا علمت أن طفلاً زوّدنا بمعلومات، فيرجى إبلاغنا لنتخذ ما يلزم.",
            "The website is not directed at children and we do not knowingly collect personal information from them. If you believe a child has provided us with information, please let us know so we can take appropriate action.",
          ],
        ],
      },
      {
        h: ["التحديثات والتواصل", "Updates and contact"],
        p: [
          [
            "قد نحدّث هذه السياسة من وقت لآخر، ويظهر تاريخ آخر تحديث في أعلى الصفحة، ويعد استمرارك في استخدام الموقع قبولاً للنسخة المحدّثة. لأي استفسار يتعلق بالخصوصية يرجى التواصل معنا عبر قنوات التواصل الرسمية المنشورة على الموقع.",
            "We may update this policy from time to time, with the date of the latest update shown at the top, and continued use of the website means you accept the updated version. For any privacy question please contact us through the official contact channels published on the website.",
          ],
        ],
      },
    ],
  },
  terms: {
    eyebrow: ["قواعد الاستخدام", "Terms of use"],
    title: ["الشروط والأحكام", "Terms and conditions"],
    lead: [
      "تنظّم هذه الشروط استخدامك للموقع. يرجى قراءتها بعناية، فاستخدامك للموقع يعني موافقتك عليها.",
      "These terms govern your use of the website. Please read them carefully: using the website means you agree to them.",
    ],
    sections: [
      {
        h: ["قبول الشروط", "Acceptance of the terms"],
        p: [
          [
            "بدخولك إلى الموقع أو استخدامه فإنك توافق على الالتزام بهذه الشروط وبالأنظمة المعمول بها. وإذا لم توافق عليها فيرجى التوقف عن استخدام الموقع.",
            "By accessing or using the website you agree to be bound by these terms and by applicable law. If you do not agree, please stop using the website.",
          ],
        ],
      },
      {
        h: ["استخدام الموقع", "Use of the website"],
        p: [
          [
            "يُتاح الموقع لاستخدامك الشخصي وغير التجاري للاطلاع على المعلومات والمحتوى المنشور فيه، ما لم يُسمح بغير ذلك كتابةً.",
            "The website is made available for your personal, non-commercial use to view the information and content published on it, unless otherwise permitted in writing.",
          ],
        ],
      },
      {
        h: ["الملكية الفكرية", "Intellectual property"],
        p: [
          [
            "المحتوى المنشور، بما في ذلك النصوص والتصاميم والصور والشعارات والعلامات التجارية، محمي بموجب أنظمة الملكية الفكرية وهو ملك لأصحابه أو مرخّص لنا باستخدامه. ولا يجوز نسخه أو إعادة نشره أو توزيعه أو استغلاله تجارياً دون إذن مسبق من صاحب الحق. وتبقى العلامات التجارية للجهات الأخرى ملكاً لأصحابها وتُعرض للتعريف فقط.",
            "Published content, including text, designs, images, logos and trademarks, is protected by intellectual property laws and belongs to its owners or is used under licence. It may not be copied, republished, distributed or exploited commercially without the owner's prior permission. Third-party trademarks remain the property of their owners and are shown for identification only.",
          ],
        ],
      },
      {
        h: ["قواعد الاستخدام المقبول", "Acceptable use"],
        p: [["يلتزم المستخدم بعدم:", "You agree not to:"]],
        items: [
          [
            "استخدام الموقع لأي غرض مخالف للأنظمة أو للآداب العامة.",
            "use the website for any unlawful purpose or in a way that breaches public decency;",
          ],
          [
            "محاولة الوصول غير المصرّح به إلى الأنظمة أو الحسابات أو البيانات، أو تجاوز إجراءات الحماية.",
            "attempt unauthorised access to systems, accounts or data, or bypass security measures;",
          ],
          [
            "تعطيل الموقع أو إثقاله، أو استخدام أدوات آلية بطريقة تضر بأدائه أو بتجربة الآخرين.",
            "disrupt or overload the website, or use automated tools in a way that harms its performance or other users' experience;",
          ],
          [
            "نشر أو إرسال برمجيات ضارة أو محتوى مضلل أو منتحل لصفة غيرك.",
            "upload or transmit malicious software or misleading content, or impersonate others.",
          ],
        ],
      },
      {
        h: ["دقة المعلومات", "Accuracy of information"],
        p: [
          [
            "نبذل جهداً معقولاً لتقديم معلومات دقيقة ومحدّثة، لكننا لا نضمن اكتمالها أو خلوّها من الأخطاء أو التأخير. وقد تعتمد بعض المعلومات على مصادر خارجية. ويُرجع في الأمور الرسمية إلى الجهات المختصة.",
            "We make reasonable efforts to provide accurate and up-to-date information, but we do not guarantee that it is complete, error-free or timely. Some information may rely on external sources. For official matters, please refer to the competent bodies.",
          ],
        ],
      },
      {
        h: ["روابط ومحتوى الأطراف الثالثة", "Third-party links and content"],
        p: [
          [
            "قد يتضمن الموقع روابط أو محتوى مضمّناً من مواقع وخدمات أخرى لا نملكها ولا نتحكم فيها، ولا نتحمل مسؤولية محتواها أو سياساتها أو ممارساتها. ووجود الرابط لا يعني تأييدنا له.",
            "The website may contain links to, or embedded content from, other websites and services that we do not own or control, and we are not responsible for their content, policies or practices. A link does not imply endorsement.",
          ],
        ],
      },
      {
        h: ["إخلاء المسؤولية", "Disclaimer"],
        p: [
          [
            "يُقدَّم الموقع ومحتواه «كما هو» و«بحسب توفره» دون ضمانات من أي نوع، صريحة كانت أو ضمنية، بما في ذلك الضمانات المتعلقة بالاستمرارية أو الملاءمة لغرض معين أو الخلو من الأخطاء أو الفيروسات.",
            "The website and its content are provided \"as is\" and \"as available\" without warranties of any kind, express or implied, including warranties of continuity, fitness for a particular purpose, or freedom from errors or viruses.",
          ],
        ],
      },
      {
        h: ["حدود المسؤولية", "Limitation of liability"],
        p: [
          [
            "إلى أقصى حد يسمح به القانون، لا نتحمل المسؤولية عن أي أضرار مباشرة أو غير مباشرة أو تبعية أو خسائر ناتجة عن استخدامك الموقع أو عدم قدرتك على استخدامه أو اعتمادك على محتواه.",
            "To the fullest extent permitted by law, we are not liable for any direct, indirect or consequential damages or losses arising from your use of, or inability to use, the website or your reliance on its content.",
          ],
        ],
      },
      {
        h: ["التوفر والتعديل", "Availability and changes"],
        p: [
          [
            "قد نعدّل الموقع أو نوقفه أو نقيّد الوصول إليه كلياً أو جزئياً في أي وقت ودون إشعار مسبق، لأغراض الصيانة أو التطوير أو الأمان. ويجوز لنا تعديل هذه الشروط في أي وقت، ويسري التعديل من تاريخ نشره، ويُعد استمرارك في الاستخدام قبولاً له.",
            "We may modify, suspend or restrict access to the website in whole or in part at any time without notice, for maintenance, development or security reasons. We may also amend these terms at any time; changes take effect when published, and continued use means you accept them.",
          ],
        ],
      },
      {
        h: ["القانون المطبّق", "Governing law"],
        p: [
          [
            "تخضع هذه الشروط وتُفسَّر وفقاً للقوانين المعمول بها في دولة ليبيا، وتختص محاكمها بالنظر في أي نزاع ينشأ عنها، ما لم يقضِ النظام بغير ذلك.",
            "These terms are governed by and construed in accordance with the laws in force in Libya, and its courts have jurisdiction over any dispute arising from them, unless the law provides otherwise.",
          ],
        ],
      },
      {
        h: ["التواصل", "Contact"],
        p: [
          [
            "لأي استفسار حول هذه الشروط يرجى التواصل معنا عبر قنوات التواصل الرسمية المنشورة على الموقع.",
            "For any question about these terms, please contact us through the official contact channels published on the website.",
          ],
        ],
      },
    ],
  },
  accessibility: {
    eyebrow: ["للجميع", "For everyone"],
    title: ["إمكانية الوصول", "Accessibility"],
    lead: [
      "نؤمن بحق الجميع في الوصول إلى المعلومات، ونعمل على أن يكون موقعنا سهل الاستخدام لأكبر عدد ممكن من الناس.",
      "We believe everyone has the right to access information, and we work to make our website usable by as many people as possible.",
    ],
    sections: [
      {
        h: ["التزامنا", "Our commitment"],
        p: [
          [
            "نسعى إلى توفير تجربة شاملة للمستخدمين من ذوي الإعاقات البصرية والسمعية والحركية والذهنية، وإلى تطبيق ممارسات إمكانية الوصول المعتمدة دولياً، ومنها إرشادات الوصول إلى محتوى الويب (WCAG)، بقدر ما تسمح به إمكاناتنا.",
            "We aim to provide an inclusive experience for users with visual, hearing, motor and cognitive disabilities, and to apply internationally recognised accessibility practices, including the Web Content Accessibility Guidelines (WCAG), as far as our resources allow.",
          ],
        ],
      },
      {
        h: ["ما نعمل عليه", "What we work on"],
        items: [
          [
            "هيكل واضح للصفحات بعناوين مرتبة وتسلسل منطقي للمحتوى.",
            "A clear page structure with ordered headings and a logical content sequence.",
          ],
          [
            "إمكانية التنقل باستخدام لوحة المفاتيح، مع إبراز العنصر النشط بوضوح.",
            "Keyboard navigation, with a clearly visible focus indicator.",
          ],
          [
            "نصوص بديلة للصور والشعارات، وتسميات واضحة للأزرار والحقول.",
            "Text alternatives for images and logos, and clear labels for buttons and form fields.",
          ],
          [
            "تباين لوني مناسب وأحجام خطوط مقروءة تتحمل التكبير دون تعطّل التصميم.",
            "Sufficient colour contrast and readable font sizes that scale without breaking the layout.",
          ],
          [
            "تصميم متجاوب يعمل على الهواتف والأجهزة اللوحية وأجهزة الحاسوب.",
            "A responsive design that works on phones, tablets and computers.",
          ],
          [
            "دعم اللغتين العربية والإنجليزية بما يناسب اتجاه الكتابة لكل منهما.",
            "Support for Arabic and English, with the reading direction appropriate to each.",
          ],
        ],
      },
      {
        h: ["التوافق مع التقنيات المساعدة", "Compatibility with assistive technologies"],
        p: [
          [
            "نعمل على أن يكون الموقع متوافقاً مع المتصفحات الحديثة وقارئات الشاشة وأدوات التكبير وأدوات التحكم الصوتي الشائعة. وقد تختلف التجربة بحسب المتصفح والجهاز والتقنية المستخدمة.",
            "We work to keep the website compatible with modern browsers, screen readers, magnification tools and common voice-control tools. The experience may vary depending on the browser, device and technology you use.",
          ],
        ],
      },
      {
        h: ["قيود معروفة", "Known limitations"],
        p: [
          [
            "رغم جهودنا قد تتوفر بعض المحتويات بدرجة أقل من الإتاحة، ومنها:",
            "Despite our efforts, some content may be less accessible, including:",
          ],
        ],
        items: [
          [
            "المحتوى المضمّن من أطراف ثالثة، مثل مقاطع الفيديو والبث والمنصات الاجتماعية، إذ تتحكم تلك الجهات في إتاحته.",
            "Embedded third-party content, such as video, live streams and social platforms, whose accessibility is controlled by those providers.",
          ],
          [
            "بعض العناصر البصرية أو التفاعلية التي قد لا تتوفر لها بدائل نصية كاملة بعد.",
            "Some visual or interactive elements that may not yet have complete text alternatives.",
          ],
          [
            "المستندات والملفات المرفقة التي قد لا تكون مهيأة لقارئات الشاشة.",
            "Attached documents and files that may not be prepared for screen readers.",
          ],
        ],
      },
      {
        h: ["نصائح لتحسين تجربتك", "Tips to improve your experience"],
        p: [
          [
            "يمكنك تكبير النص من إعدادات المتصفح (Ctrl و+)، أو تفعيل وضع القراءة، أو استخدام قارئ الشاشة المدمج في جهازك، أو تبديل لغة الموقع من الزر في أعلى الصفحة.",
            "You can enlarge text with your browser's zoom (Ctrl and +), use reader mode, use the screen reader built into your device, or switch the site language from the button at the top of the page.",
          ],
        ],
      },
      {
        h: ["ملاحظاتك واقتراحاتك", "Feedback"],
        p: [
          [
            "نرحب بملاحظاتك. إذا واجهت صعوبة في الوصول إلى أي جزء من الموقع أو لديك اقتراح لتحسينه، فيرجى التواصل معنا عبر قنوات التواصل الرسمية المنشورة على الموقع مع ذكر الصفحة والمشكلة ونوع الجهاز أو التقنية المستخدمة، وسنسعى إلى الرد ومعالجة المشكلة في أقرب وقت ممكن.",
            "We welcome your feedback. If you have difficulty accessing any part of the website or have a suggestion to improve it, please contact us through the official contact channels published on the website, naming the page, the problem and the device or technology you use, and we will do our best to respond and fix the issue as soon as possible.",
          ],
        ],
      },
      {
        h: ["التحسين المستمر", "Continuous improvement"],
        p: [
          [
            "إمكانية الوصول عملية مستمرة، ونراجع الموقع بانتظام ونطوّره كلما أضفنا محتوى أو ميزات جديدة.",
            "Accessibility is an ongoing effort. We review the website regularly and improve it whenever we add new content or features.",
          ],
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
        {doc.sections.map((s, n) => (
          <section className="legal-section" key={s.h[0]}>
            <h2>
              <span className="legal-no" aria-hidden="true">
                {String(n + 1).padStart(2, "0")}
              </span>
              {s.h[i]}
            </h2>
            {s.p?.map((para) => (
              <p key={para[0]}>{para[i]}</p>
            ))}
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
