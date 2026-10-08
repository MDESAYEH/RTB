"use client";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { TournamentLogo } from "./tournament-logo";
const factIcons = {
  ball: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="fi-ball" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ff9a4d" />
          <stop offset="1" stopColor="#e0460a" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="url(#fi-ball)" />
      <g fill="none" stroke="#2a1205" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="32" cy="32" r="29" />
        <path d="M3 32h58M32 3v58M10 11c22 12 22 30 0 42M54 11c-22 12-22 30 0 42" />
      </g>
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <radialGradient id="fi-globe" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#5cc8ff" />
          <stop offset="1" stopColor="#0a63c9" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="url(#fi-globe)" />
      <path d="M20 12c6-2 11 1 12 6s-5 5-4 10-8 6-11 2-3-14 3-18zM38 30c5-3 12 0 13 6s-4 14-9 15-6-8-7-12 0-7 3-9z" fill="#2fbf6c" />
      <g fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6">
        <circle cx="32" cy="32" r="29" />
        <ellipse cx="32" cy="32" rx="12" ry="29" />
        <path d="M5 24h54M5 40h54" />
      </g>
    </svg>
  ),
  group: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="fi-ga" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7a45" />
          <stop offset="1" stopColor="#d62f45" />
        </linearGradient>
        <linearGradient id="fi-gb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2fd08a" />
          <stop offset="1" stopColor="#0d7f55" />
        </linearGradient>
      </defs>
      <circle cx="22" cy="32" r="19" fill="url(#fi-ga)" stroke="#fff" strokeWidth="2.5" />
      <circle cx="42" cy="32" r="19" fill="url(#fi-gb)" stroke="#fff" strokeWidth="2.5" />
      <text x="15" y="40" fontSize="22" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">A</text>
      <text x="37" y="40" fontSize="22" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">B</text>
    </svg>
  ),
  road: (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="fi-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="1" stopColor="#ff5e24" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="url(#fi-sky)" />
      <circle cx="42" cy="22" r="6" fill="#fff3b0" />
      <path d="M3.5 46 21 22l9 12 7-9 23.5 21A29 29 0 0 1 32 61 29 29 0 0 1 3.5 46z" fill="#1d3b2f" />
      <path d="M32 61c-2-6 1-9 0-13s-2-6 0-9h0c2 3 2 5 0 9s2 7 0 13z" fill="#ffd34d" />
    </svg>
  ),
};
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
        <picture className="poster-background" aria-hidden="true">
          <source
            media="(max-width: 700px)"
            srcSet="/fa03d6d7-02b1-47c7-b272-31f78f0a6947.png"
          />
          <img
            src="/0d09b692-c5de-4597-9837-1324b8b56828.png"
            alt=""
            fetchPriority="high"
          />
        </picture>
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
          </div>
        </div>
      </section>
      <div className="poster-facts" dir="ltr">
        <div>
          {factIcons.ball}
          <strong>{clubs} CLUBS</strong>
        </div>
        <div>
          {factIcons.globe}
          <strong>{nations} NATIONS</strong>
        </div>
        <div>
          {factIcons.group}
          <strong>{groups} GROUPS</strong>
        </div>
        <div>
          {factIcons.road}
          <strong>ONE ROAD.</strong>
        </div>
      </div>
    </>
  );
}
