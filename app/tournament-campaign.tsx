"use client";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronLeft, ArrowUpLeft, ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TournamentLogo } from "./tournament-logo";
import { LangToggle, useLang } from "./i18n";
const primarySections = [
  ["/", "الرئيسية"],
  ["/matches", "المباريات"],
  ["/standings", "الترتيب"],
  ["/teams", "الفرق"],
  ["/the-road", "THE ROAD"],
];
const secondarySections = [
  ["/stats", "الإحصائيات"],
  ["/news", "الأخبار"],
];
const sections = [...primarySections, ...secondarySections];
function Brand({ header = false }: { header?: boolean }) {
  const { tr } = useLang();
  return (
    <Link
      className="tournament-brand"
      href="/"
      aria-label={`ROAD TO BAL — ${tr("الرئيسية")}`}
    >
      <TournamentLogo header={header} />
      <span className="tournament-brand-location">
        <strong>ROAD TO BAL</strong>
        <small>TRIPOLI · LIBYA</small>
      </span>
    </Link>
  );
}
export function TournamentHeader() {
  const { dir, tr } = useLang();
  const pathname = usePathname(),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 88);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  function close() {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }
  function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const targets = [
      ...event.currentTarget.querySelectorAll<
        HTMLAnchorElement | HTMLButtonElement
      >("a[href], button:not([disabled])"),
    ].filter((element) => element.getClientRects().length);
    const first = targets[0],
      last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  const isActive = (url: string) =>
    url === "/"
      ? pathname === "/"
      : pathname === url ||
        pathname.startsWith(url + "/") ||
        (url === "/teams" && pathname.startsWith("/team/"));
  function item(url: string, label: string, mobile = false, i = 0) {
    return (
      <Link
        key={url}
        href={url}
        aria-current={isActive(url) ? "page" : undefined}
        onClick={mobile ? close : undefined}
      >
        {mobile && <small>{String(i + 1).padStart(2, "0")}</small>}
        <span>{tr(label)}</span>
        {mobile && (
          <i aria-hidden="true">
            {dir === "rtl" ? <ArrowUpLeft size={26} /> : <ArrowUpRight size={26} />}
          </i>
        )}
      </Link>
    );
  }
  function links(mobile = false) {
    const ordered = [
      sections[0],
      sections[1],
      secondarySections[1],
      sections[2],
      sections[3],
      ["/the-road", "The Road"],
      secondarySections[0],
    ];
    return ordered.map(([url, label], i) => item(url, label, mobile, i));
  }
  return (
    <>
      <header
        className={
          "tournament-header " +
          (pathname === "/" ? "is-home " : "") +
          (scrolled ? "is-scrolled" : "")
        }
      >
        <Link className="header-fiba" href="/" aria-label="FIBA Africa">
          <span className="header-fiba-ball">
            <Image
              src="/Artboard%202-8.png"
              alt=""
              width={875}
              height={1800}
              sizes="42px"
            />
          </span>
          <span className="header-fiba-wordmark">
            <strong>FIBA</strong>
            <b>AFRICA</b>
            <small>We Are Basketball</small>
          </span>
        </Link>
        <div className="header-tools">
          <Link
            className="header-search"
            href="/news#news-search"
            aria-label={tr("بحث")}
          >
            <Search size={15} />
            <span>{tr("بحث")}</span>
          </Link>
          <LangToggle className="header-lang" />
        </div>
        <nav
          className="tournament-nav"
          aria-label={tr("أقسام البطولة")}
          dir={dir}
        >
          {links()}
        </nav>
        <Brand header />
        <button
          ref={trigger}
          className="menu-trigger"
          aria-label={tr("فتح قائمة البطولة")}
          aria-haspopup="dialog"
          aria-controls="tournament-menu"
          aria-expanded={open}
          onClick={() => {
            dialog.current?.showModal();
            dialog.current?.focus({ preventScroll: true });
            setOpen(true);
          }}
        >
          <span>{tr("القائمة")}</span>
          <i aria-hidden="true">
            <span />
            <span />
          </i>
        </button>
      </header>
      <dialog
        ref={dialog}
        id="tournament-menu"
        className="tournament-menu"
        tabIndex={-1}
        aria-labelledby="menu-title"
        onKeyDown={trapFocus}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
        }}
      >
        <div className="menu-head">
          <Brand />
          <button
            className="menu-close"
            aria-label={tr("إغلاق قائمة البطولة")}
            onClick={close}
          >
            ✕
          </button>
        </div>
        <div className="menu-context">
          <span id="menu-title">ROAD TO BAL / TRIPOLI 2027</span>
          <TournamentLogo />
        </div>
        <nav
          className="mobile-tournament-nav"
          aria-label={tr("أقسام البطولة على الهاتف")}
          dir={dir}
        >
          {links(true)}
        </nav>
        <LangToggle className="menu-lang" />
        <div className="menu-foot">
          <span>21—23 OCT 2026</span>
          <span>TRIPOLI, LIBYA</span>
        </div>
      </dialog>
    </>
  );
}
export function CampaignHero() {
  const { dir, tr } = useLang();
  return (
    <>
      <section
        className="tipoff-hero tripoli-poster"
        aria-label={`${tr("طرابلس")} — Road to BAL`}
        dir="ltr"
      >
        <picture className="poster-background" aria-hidden="true">
          <source media="(max-width: 700px)" srcSet="/hero-road-mobile.webp" />
          <img
            src="/hero-road.webp"
            alt=""
            width={2000}
            height={1126}
            fetchPriority="high"
          />
        </picture>
        <div className="poster-copy">
          <p className="poster-title">
            ROAD TO BAL <span>/ 2027</span>
          </p>
          <h1 dir={dir}>
            <span className="hero-line-red">{tr("أفريقيا تجتمع معاً")}</span>
            <span className="hero-line-gold">{tr("وطرابلس تتصدر المشهد")}</span>
          </h1>
          <div className="poster-bottom">
            <div className="poster-road">
              <Link href="/the-road" dir={dir}>
                {tr("الطريق يبدأ هنا")} <ChevronLeft aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
