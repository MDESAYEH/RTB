"use client";
import Link from "next/link";
import Image from "next/image";
import { Globe, Users, Mountain, ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BasketballGlyph } from "./brand-primitives";
import { TournamentLogo } from "./tournament-logo";
const sections = [
  ["/", "الرئيسية"],
  ["/matches", "المباريات"],
  ["/standings", "الترتيب"],
  ["/teams", "الفرق"],
  ["/stats", "الإحصائيات"],
  ["/the-road", "THE ROAD"],
  ["/news", "الأخبار"],
];
function Brand() {
  return (
    <Link
      className="tournament-brand"
      href="/"
      aria-label="ROAD TO BAL — الرئيسية"
    >
      <TournamentLogo />
      <span className="tournament-brand-location">TRIPOLI / 2027</span>
    </Link>
  );
}
export function TournamentHeader() {
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
  function links(mobile = false) {
    return sections.map(([url, label], i) => (
      <Link
        key={url}
        href={url}
        aria-current={
          (
            url === "/"
              ? pathname === "/"
              : pathname === url ||
                pathname.startsWith(url + "/") ||
                (url === "/teams" && pathname.startsWith("/team/"))
          )
            ? "page"
            : undefined
        }
        onClick={mobile ? close : undefined}
      >
        {mobile && <small>{String(i + 1).padStart(2, "0")}</small>}
        <span>{label}</span>
        {mobile && <i aria-hidden="true">↗</i>}
      </Link>
    ));
  }
  return (
    <>
      <header
        className={"tournament-header " + (scrolled ? "is-scrolled" : "")}
      >
        <Brand />
        <nav className="tournament-nav" aria-label="أقسام البطولة" dir="rtl">
          {links()}
        </nav>
        <div className="event-meta" dir="ltr">
          <strong>21—25 OCT</strong>
          <span>2026 / TRIPOLI, LIBYA</span>
        </div>
        <button
          ref={trigger}
          className="menu-trigger"
          aria-label="فتح قائمة البطولة"
          aria-haspopup="dialog"
          aria-controls="tournament-menu"
          aria-expanded={open}
          onClick={() => {
            dialog.current?.showModal();
            setOpen(true);
          }}
        >
          <span>القائمة</span>
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
            aria-label="إغلاق قائمة البطولة"
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
          aria-label="أقسام البطولة على الهاتف"
          dir="rtl"
        >
          {links(true)}
        </nav>
        <div className="menu-foot">
          <span>21—25 OCT 2026</span>
          <span>TRIPOLI, LIBYA</span>
        </div>
      </dialog>
    </>
  );
}
export function CampaignHero({
  count,
  seconds,
  ended,
  clubs,
  nations,
  groups,
}: {
  count: number[];
  seconds: number;
  ended: boolean;
  clubs: number;
  nations: number;
  groups: number;
}) {
  return (
    <>
      <section
        className="tipoff-hero tripoli-poster"
        aria-label="طرابلس — Road to BAL"
        dir="ltr"
      >
        <Image
          className="poster-background"
          src="/0d09b692-c5de-4597-9837-1324b8b56828.png"
          alt=""
          fill
          sizes="(max-width: 700px) 1400px, 100vw"
          preload
        />
        <div className="poster-copy">
          <p className="poster-eyebrow">AFRICAN BASKETBALL. NEXT CHAPTER.</p>
          <p className="poster-title">
            ROAD TO BAL <span>/ 2027</span>
          </p>
          <h1>
            TRIPOLI
            <span aria-hidden="true" />
          </h1>
          <p className="poster-arabic" dir="rtl">
            طرابلس تستضيف أفريقيا
          </p>
        </div>
        <div className="poster-bottom">
          <div className="poster-timing">
            <div className="poster-date">
              <strong>21—25</strong>
              <span>OCTOBER 2026</span>
            </div>
            {seconds > 0 ? (
              <div
                className="poster-countdown"
                aria-label="العد التنازلي لبدء البطولة"
              >
                {count.map((n, i) => (
                  <div key={i}>
                    <strong suppressHydrationWarning>
                      {String(n).padStart(2, "0")}
                    </strong>
                    <span>{["DAYS", "HOURS", "MINUTES", "SECONDS"][i]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Link className="poster-live" href="/matches">
                {ended ? "النتائج النهائية" : "تابع المباريات"}
              </Link>
            )}
          </div>
          <div className="poster-road">
            <Link href="/the-road" dir="rtl">
              الطريق يبدأ هنا <ChevronLeft aria-hidden="true" />
            </Link>
            <div className="poster-markers" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      </section>
      <div className="poster-facts" dir="ltr">
        <p>THE CONTINENT TAKES THE COURT</p>
        <div>
          <BasketballGlyph />
          <strong>{clubs} CLUBS</strong>
        </div>
        <div>
          <Globe />
          <strong>{nations} NATIONS</strong>
        </div>
        <div>
          <Users />
          <strong>{groups} GROUPS</strong>
        </div>
        <div>
          <Mountain />
          <strong>ONE ROAD.</strong>
        </div>
      </div>
    </>
  );
}
