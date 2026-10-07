"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BasketballGlyph, CourtArc } from "./brand-primitives";
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
      <BasketballGlyph />
      <span>
        ROAD TO <b>BAL</b>
        <small>TRIPOLI / 2027</small>
      </span>
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
    trigger.current?.focus();
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
          trigger.current?.focus();
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
          <BasketballGlyph />
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
}: {
  count: number[];
  seconds: number;
  ended: boolean;
}) {
  return (
    <section className="tipoff-hero" aria-label="طرابلس — Road to BAL">
      <div className="tipoff-topline" dir="ltr">
        <span>AFRICAN BASKETBALL / NEXT CHAPTER</span>
        <span>WEST DIVISION · GROUPS A & B</span>
      </div>
      <div className="tipoff-photo">
        <img
          src="/images/hero-match-reference.png"
          alt="لاعب الاتحاد يصوب أمام المدافع داخل ملعب كرة السلة"
          fetchPriority="high"
        />
        <span className="photo-caption" dir="ltr">
          THE GAME. THE CITY. THE ROAD.
        </span>
      </div>
      <CourtArc className="tipoff-arc" />
      <div className="tipoff-copy">
        <span className="tipoff-kicker" dir="ltr">
          ROAD TO BAL <b>2027</b>
        </span>
        <h1>
          طرابلس
          <br />
          <span>تستضيف أفريقيا</span>
        </h1>
        <p>
          عشرة أندية. عشر دول.
          <br />
          كل الطرق تلتقي على هذا الملعب.
        </p>
        <Link className="tipoff-action" href="/matches">
          <span>استكشف المباريات</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="tipoff-city">
        <img
          src="/images/hero-tripoli-reference.png"
          alt="أضواء طرابلس على البحر"
        />
        <span dir="ltr">
          TRIPOLI
          <br />
          <small>LIBYA / HOST CITY</small>
        </span>
      </div>
      <strong className="tipoff-word" dir="ltr" aria-hidden="true">
        TRIPOLI<span>↗</span>
      </strong>
      <div className="tipoff-bottom" dir="ltr">
        <div className="tipoff-date">
          <strong>21—25</strong>
          <span>
            OCTOBER
            <br />
            2026
          </span>
        </div>
        {seconds > 0 ? (
          <div className="tipoff-countdown" aria-label="العد التنازلي">
            <span className="countdown-label">UNTIL TIP-OFF</span>
            <div>
              {count.map((n, i) => (
                <span key={i}>
                  <b suppressHydrationWarning>{String(n).padStart(2, "0")}</b>
                  <small>{["DAYS", "HRS", "MIN", "SEC"][i]}</small>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <Link href="/matches">
            {ended ? "النتائج النهائية" : "أيام البطولة — تابع المباريات"}
          </Link>
        )}
        <Link className="tipoff-road-link" href="/the-road">
          THE ROAD <span>↗</span>
        </Link>
      </div>
    </section>
  );
}
