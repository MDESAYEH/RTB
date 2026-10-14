"use client";
import { uploadMedia } from "@/lib/media-client";
import { useEffect, useState, useRef } from "react";
import { CalendarDays, Newspaper, Users } from "lucide-react";
import { TournamentLogo } from "./tournament-logo";
import { useLang } from "./i18n";
import { Empty, statusLabel, type Data } from "./site-shared";
import { transitions, remainingClock, stale } from "@/lib/public-domain";
import { roleLabels, type Role, type Permission } from "@/lib/permissions";
import {
  PasswordField,
  SecurityPanel,
  UsersPanel,
  type Me,
  type Setup,
  type UserRow,
} from "./admin-accounts";
const KIND_LABELS: Record<string, string> = {
  events: "البطولة",
  teamStats: "إحصاءات الفرق",
  games: "المباريات",
  teams: "الأندية",
  players: "اللاعبون",
  news: "الأخبار",
  pulse: "نبض البطولة",
  stats: "إحصاءات اللاعبين",
  settings: "الإعدادات",
};
const AUDIT_ACTIONS: Record<string, string> = {
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
  save: "حفظ بيانات",
  upload: "رفع صورة",
  correct: "تصحيح إداري",
  "user:create": "إنشاء حساب",
  "user:role": "تغيير دور",
  "user:password": "إعادة تعيين كلمة المرور",
  "user:disable": "تعطيل حساب",
  "user:enable": "تفعيل حساب",
  "user:delete": "حذف حساب",
  "fiba-update": "تحديث من FIBA",
  "fiba-create": "إضافة من FIBA",
  historical: "سجل قديم",
};
const AUDIT_KINDS: Record<string, string> = {
  ...KIND_LABELS,
  auth: "الدخول",
  users: "الحسابات",
  media: "الصور",
};
const AUDIT_ACTORS: Record<string, string> = {
  admin: "المدير",
  seed: "النظام (بيانات أولية)",
  "fiba-sync": "مزامنة FIBA",
};
function auditText(value: unknown): string {
  const text =
    typeof value === "string" ? value : (JSON.stringify(value) ?? "—");
  return text.length > 90 ? text.slice(0, 90) + "…" : text || "—";
}
/** Field-level before/after list for one audit row; unreadable rows just show no changes. */
function auditChanges(a: Record<string, unknown>) {
  try {
    const before = a.old ? JSON.parse(String(a.old)) : null;
    const after = a.new ? JSON.parse(String(a.new)) : null;
    if (!after || typeof after !== "object" || Array.isArray(after)) return [];
    const base =
      before && typeof before === "object" && !Array.isArray(before)
        ? (before as Record<string, unknown>)
        : {};
    const next = after as Record<string, unknown>;
    return Object.keys(next)
      .filter(
        (key) =>
          !["version", "updatedAt"].includes(key) &&
          JSON.stringify(base[key]) !== JSON.stringify(next[key]),
      )
      .slice(0, 12)
      .map((key) => ({
        key,
        from: key in base ? auditText(base[key]) : "—",
        to: auditText(next[key]),
      }));
  } catch {
    return [];
  }
}
const CONTENT_TABS = [
  ["games", "المباريات"],
  ["teams", "الأندية"],
  ["players", "اللاعبون"],
  ["news", "الأخبار"],
  ["more", "الإعدادات وأخرى"],
];
const MORE_KINDS = ["settings", "events", "pulse", "stats", "teamStats"];
const UPLOAD_KINDS = ["teams", "players", "news"];
export function Admin({
  data,
  onData,
}: {
  data: Data;
  onData: (data: Data) => void;
}) {
  const { lang, tr } = useLang();
  const [auth, setAuth] = useState(false),
    [password, setPassword] = useState(""),
    [tab, setTab] = useState("live"),
    [error, setError] = useState(""),
    [records, setRecords] = useState<
      { kind: string; value: Record<string, unknown> }[]
    >([]),
    [audit, setAudit] = useState<Record<string, unknown>[]>([]),
    [fiba, setFiba] = useState<{
      finished: string;
      status: string;
      error: string | null;
    } | null>(null),
    [kind, setKind] = useState("games"),
    [json, setJson] = useState(""),
    [selected, setSelected] = useState(""),
    [clock, setClock] = useState(600),
    [identifier, setIdentifier] = useState(""),
    [me, setMe] = useState<Me | null>(null),
    [users, setUsers] = useState<UserRow[]>([]),
    [otp, setOtp] = useState(""),
    [needOtp, setNeedOtp] = useState(false),
    [setup, setSetup] = useState<Setup | null>(null),
    [codes, setCodes] = useState<string[] | null>(null);
  const has = (p: Permission) => !!me?.permissions.includes(p);
  // Each tab needs the permission the server will also require for its commands.
  const allowed = (id: string) =>
    id === "live"
      ? has("game:control")
      : ["games", "teams", "more", "audit"].includes(id)
        ? has("tournament:write")
        : ["players", "news"].includes(id)
          ? has("content:write")
          : id === "users"
            ? has("users:manage")
            : true;
  async function load() {
    const r = await fetch("/api/admin");
    if (r.ok) {
      const v = await r.json();
      setAuth(true);
      setRecords(v.records);
      setAudit(v.audit);
      setFiba(v.fiba ?? null);
      setMe(v.me ?? null);
      setUsers(v.users ?? []);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!me || allowed(tab)) return;
    const first = [
      "live",
      "games",
      "teams",
      "players",
      "news",
      "more",
      "health",
      "audit",
      "users",
    ].find(allowed);
    if (!first) return;
    setTab(first);
    if (CONTENT_TABS.some(([t]) => t === first)) {
      setKind(first === "more" ? MORE_KINDS[0] : first);
      setJson("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab]);
  const saving = useRef(false);
  const latest = useRef(data);
  latest.current = data;
  const [busy, setBusy] = useState(false),
    [danger, setDanger] = useState<Record<string, unknown> | null>(null),
    [correction, setCorrection] = useState(""),
    [reason, setReason] = useState(""),
    [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function mutate(body: unknown) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    const command: Record<string, unknown> = {
      ...(body as Record<string, unknown>),
      requestId: crypto.randomUUID(),
    };
    if (command.id && command.action !== "save")
      command.version = latest.current.games.find(
        (g) => g.id === command.id,
      )?.version;
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      const v = await r.json();
      if (!r.ok) {
        setError(v.error);
        if (v.needOtp) setNeedOtp(true);
        if (r.status === 403 && v.code === "2fa-required") void load();
        if (r.status === 409) {
          const snapshot = await (
            await fetch("/api/data", { cache: "no-store" })
          ).json();
          onData(snapshot);
          latest.current = snapshot;
        }
        return;
      }
      if (v.data) {
        onData(v.data);
        latest.current = v.data;
      }
      setDanger(null);
      const act = (body as { action: string }).action;
      if (act === "2fa:begin") setSetup({ secret: v.secret, qr: v.qr });
      if (act === "2fa:confirm") {
        setCodes(v.recoveryCodes);
        setSetup(null);
        setTab("security");
      }
      if (act === "2fa:disable") {
        setSetup(null);
        setCodes(null);
      }
      if (act === "login") {
        setOtp("");
        setNeedOtp(false);
      }
      if ((body as { action: string }).action === "logout") {
        setAuth(false);
        return;
      }
      await load();
      const done = (body as { action: string }).action;
      if (done !== "login")
        setToast(
          done === "save" ? tr("تم الحفظ بنجاح") : tr("تم تنفيذ الإجراء بنجاح"),
        );
    } catch {
      setError(tr("تعذر الاتصال؛ تحقق من الشبكة قبل إعادة المحاولة."));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  const g = data.games.find((g) => g.id === selected) || data.games[0];
  useEffect(() => {
    const game =
      latest.current.games.find((game) => game.id === selected) ||
      latest.current.games[0];
    setClock(game?.clock ?? 600);
  }, [selected]);
  let draft: Record<string, unknown> = {};
  try {
    draft = JSON.parse(json || "{}");
    if (["settings", "games"].includes(kind) && draft.streamUrl === undefined)
      draft = { ...draft, streamUrl: "" };
  } catch {}
  const template: Record<string, unknown> = {
    events: {
      id: crypto.randomUUID(),
      game: "",
      period: 1,
      clock: "10:00",
      text: "",
      date: new Date().toISOString(),
    },
    teamStats: {
      id: crypto.randomUUID(),
      game: "",
      team: data.teams[0]?.id,
      fgMade: 0,
      fgAttempted: 0,
      twoMade: 0,
      twoAttempted: 0,
      threeMade: 0,
      threeAttempted: 0,
      ftMade: 0,
      ftAttempted: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
      fouls: 0,
    },
    games: {
      id: crypto.randomUUID(),
      home: data.teams[0]?.id,
      away: data.teams[1]?.id,
      group: "A",
      date: "2026-10-21T18:00:00+02:00",
      venue: "",
      status: "Scheduled",
    },
    teams: {
      id: "team-id",
      name: "",
      country: "",
      group: "A",
      verified: false,
    },
    players: {
      id: crypto.randomUUID(),
      team: data.teams[0]?.id,
      name: "",
      number: 0,
      position: "",
    },
    news: {
      id: crypto.randomUUID(),
      title: "",
      titleEn: "",
      slug: "article-slug",
      excerpt: "",
      excerptEn: "",
      content: "",
      contentEn: "",
      author: "",
      publishedAt: new Date().toISOString(),
      status: "draft",
    },
    pulse: {
      id: crypto.randomUUID(),
      text: "",
      textEn: "",
      date: new Date().toISOString(),
    },
    settings: data.settings,
    stats: {
      id: crypto.randomUUID(),
      game: "",
      player: "",
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      efficiency: 0,
    },
  };
  if (!auth)
    return (
      <div className="login">
        <div className="admin-login-brand">
          <TournamentLogo header />
          <span>
            ROAD TO BAL<small>TRIPOLI · LIBYA</small>
          </span>
        </div>
        <h2>{tr("دخول الإدارة")}</h2>
        <p className="admin-login-intro">
          {lang === "ar"
            ? "من هنا تُدار البطولة. سجّل الدخول لمتابعة المباريات وتحديث أخبار الأندية."
            : "Manage the tournament, follow matches and update club news from one place."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mutate({ action: "login", identifier, password, otp });
          }}
        >
          <label>
            {lang === "ar" ? "البريد الإلكتروني أو رقم الهاتف" : "Email or phone"}
            <input
              type="text"
              className="admin-field-ltr"
              dir="ltr"
              inputMode="email"
              autoComplete="username"
              placeholder="name@example.com / +218…"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </label>
          <label>
            {tr("كلمة المرور")}
            <PasswordField value={password} onChange={setPassword} />
          </label>
          {needOtp && (
            <label>
              {lang === "ar"
                ? "رمز التحقق من تطبيق المصادقة (أو رمز استرداد)"
                : "Authenticator code (or a recovery code)"}
              <input
                type="text"
                className="admin-field-ltr"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={12}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoFocus
                required
              />
            </label>
          )}
          <button className="primary">{tr("دخول آمن")}</button>
        </form>
        {error && <p role="alert">{error}</p>}
        <p className="muted">
          {tr("يلزم إنشاء حساب الإدارة من الخادم قبل تسجيل الدخول.")}
        </p>
      </div>
    );
  if (me && me.twoFactor.required && !me.twoFactor.enabled)
    return (
      <div className="admin" aria-busy={busy}>
        <SecurityPanel
          me={me}
          setup={setup}
          codes={codes}
          busy={busy}
          lang={lang === "ar" ? "ar" : "en"}
          forced
          error={error}
          onRun={(body) => void mutate(body)}
        />
        <button onClick={() => void mutate({ action: "logout" })}>
          {tr("خروج")}
        </button>
      </div>
    );
  return (
    <div className="admin" aria-busy={busy}>
      <section
        className="admin-overview"
        aria-label={lang === "ar" ? "ملخص البطولة" : "Tournament overview"}
      >
        {[
          {
            id: "teams",
            label: tr("الأندية"),
            count: data.teams.length,
            icon: Users,
          },
          {
            id: "games",
            label: tr("المباريات"),
            count: data.games.length,
            icon: CalendarDays,
          },
          {
            id: "news",
            label: tr("الأخبار"),
            count: data.news.length,
            icon: Newspaper,
          },
        ].map(({ id, label, count, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => {
              setTab(id);
              setKind(id);
              setJson("");
            }}
          >
            <span>
              <Icon size={20} aria-hidden="true" />
              {label}
            </span>
            <strong>{count}</strong>
            <small>{lang === "ar" ? "عرض وإدارة" : "View and manage"} ↗</small>
          </button>
        ))}
      </section>
      <div className="tabs">
        {[
          ["live", "التحكم المباشر"],
          ...CONTENT_TABS,
          ["health", "صحة البيانات"],
          ["audit", "سجل التدقيق"],
          ["users", "المستخدمون"],
          ["security", "حماية الحساب"],
        ]
          .filter(([id]) => allowed(id))
          .map(([id, title]) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              if (CONTENT_TABS.some(([t]) => t === id)) {
                setKind(id === "more" ? MORE_KINDS[0] : id);
                setJson("");
              }
            }}
            className={tab === id ? "active" : ""}
            aria-pressed={tab === id}
          >
            {tr(title)}
          </button>
        ))}
        {me && (
          <span className="admin-whoami" dir="ltr">
            {me.identifier ?? me.id} ·{" "}
            {roleLabels[me.role as Role]?.[lang === "ar" ? "ar" : "en"] ??
              me.role}
          </span>
        )}
        <button onClick={() => void mutate({ action: "logout" })}>
          {tr("خروج")}
        </button>
      </div>
      {danger && (
        <dialog
          ref={(element) => {
            if (element && !element.open) element.showModal();
          }}
          className="admin-confirm"
          onCancel={() => setDanger(null)}
          aria-labelledby="confirm-title"
        >
          <h2 id="confirm-title">
            {danger.action === "correct"
              ? tr("تصحيح إداري موثق")
              : tr("تأكيد تغيير حالة المباراة")}
          </h2>
          <p>
            {tr("راجع الفريقين والنتيجة. سيُحفظ هذا الإجراء في سجل التدقيق.")}
          </p>
          {danger.action === "correct" && (
            <>
              <label>
                {tr("بيانات المباراة المصححة (JSON)")}
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  rows={12}
                />
              </label>
              <label>
                {tr("سبب التصحيح")}
                <input
                  value={reason}
                  minLength={8}
                  maxLength={400}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </>
          )}
          <button
            disabled={busy}
            className="primary"
            onClick={() => {
              try {
                void mutate(
                  danger.action === "correct"
                    ? {
                        ...danger,
                        value: JSON.parse(correction),
                        reason,
                        confirmed: true,
                      }
                    : danger,
                );
              } catch {
                setError(tr("JSON غير صالح"));
              }
            }}
          >
            {tr("تأكيد وحفظ")}
          </button>
          <button disabled={busy} onClick={() => setDanger(null)}>
            {tr("إلغاء")}
          </button>
        </dialog>
      )}
      {error && (
        <p className="notice admin-toast admin-toast-error" role="alert">
          {error}
        </p>
      )}
      {toast && !error && (
        <div className="admin-toast" role="status">
          <span aria-hidden="true">✓</span> {toast}
        </div>
      )}
      {tab === "live" &&
        (g ? (
          <>
            <label>
              {tr("المباراة")}
              <select
                value={g.id}
                aria-label={tr("المباراة")}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setClock(
                    data.games.find((g) => g.id === e.target.value)?.clock || 0,
                  );
                }}
              >
                {data.games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {data.teams.find((t) => t.id === g.home)?.name} /{" "}
                    {data.teams.find((t) => t.id === g.away)?.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="live-room" dir="ltr">
              {(["home", "away"] as const).map((side) => (
                <div key={side}>
                  <h3>{data.teams.find((t) => t.id === g[side])?.name}</h3>
                  <strong>
                    {g[side === "home" ? "homeScore" : "awayScore"]}
                  </strong>
                  <div>
                    {[1, 2, 3].map((p) => (
                      <button
                        aria-label={
                          tr("إضافة") +
                          " " +
                          p +
                          " " +
                          tr("إلى") +
                          " " +
                          data.teams.find((t) => t.id === g[side])?.name
                        }
                        disabled={busy || g.status !== "Live"}
                        key={p}
                        onClick={() =>
                          void mutate({
                            action: "score",
                            id: g.id,
                            version: g.version,
                            side,
                            points: p,
                          })
                        }
                      >
                        +{p}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p>
              {tr("الحالة")}: {tr(statusLabel[g.status])} · Q{g.quarter}
              <b className="operator-clock" dir="ltr">
                {String(Math.floor(remainingClock(g) / 60)).padStart(2, "0")}:
                {String(remainingClock(g) % 60).padStart(2, "0")}
              </b>
            </p>
            <div className="controls">
              {transitions[g.status].map((status) => (
                <button
                  key={status}
                  disabled={busy}
                  onClick={() =>
                    ["Ended", "Cancelled"].includes(status)
                      ? setDanger({
                          action: "status",
                          id: g.id,
                          version: g.version,
                          status,
                        })
                      : void mutate({
                          action: "status",
                          id: g.id,
                          version: g.version,
                          status,
                        })
                  }
                >
                  {tr(statusLabel[status])}
                </button>
              ))}
              <button
                onClick={() =>
                  void mutate({ action: "undo", id: g.id, version: g.version })
                }
              >
                {tr("تراجع")} / Undo
              </button>
            </div>
            {["Live", "Halftime", "Ended"].includes(g.status) && (
              <button
                disabled={busy}
                onClick={() => {
                  setCorrection(JSON.stringify(g, null, 2));
                  setReason("");
                  setDanger({
                    action: "correct",
                    id: g.id,
                    version: g.version,
                  });
                }}
              >
                {tr("تصحيح إداري موثق")}
              </button>
            )}
            <div className="controls">
              <label>
                {tr("الساعة (ثوانٍ)")}
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={clock}
                  onChange={(e) => setClock(Number(e.target.value))}
                />
              </label>
              <button
                onClick={() =>
                  void mutate({
                    action: "clock",
                    id: g.id,
                    version: g.version,
                    clock,
                    running: false,
                  })
                }
              >
                {tr("ضبط")}
              </button>
              <button
                onClick={() =>
                  void mutate({
                    action: "clock",
                    id: g.id,
                    version: g.version,
                    running: true,
                  })
                }
              >
                Start / Resume
              </button>
              <button
                onClick={() =>
                  void mutate({
                    action: "clock",
                    id: g.id,
                    version: g.version,
                    running: false,
                  })
                }
              >
                Pause
              </button>
              <button
                onClick={() =>
                  void mutate({
                    action: "clock",
                    id: g.id,
                    version: g.version,
                    quarter: g.quarter + 1,
                    clock: g.quarter >= 4 ? 300 : 600,
                    running: false,
                  })
                }
              >
                {tr("الفترة التالية")}
              </button>
            </div>
          </>
        ) : (
          <Empty title={tr("أنشئ مباراة معتمدة من محرر البيانات للبدء.")} />
        ))}
      {CONTENT_TABS.some(([t]) => t === tab) && (
        <>
          {UPLOAD_KINDS.includes(kind) && (
            <label className="admin-upload">
              {tr("رفع صورة معتمدة (PNG / JPEG / WebP، حتى 5 MB)")}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const v = await uploadMedia(file);
                    const key =
                      kind === "teams"
                        ? "logo"
                        : kind === "players"
                          ? "photo"
                          : "cover";
                    setJson(
                      JSON.stringify({ ...draft, [key]: v.url }, null, 2),
                    );
                  } catch {
                    setError(tr("تعذر رفع الصورة"));
                  }
                }}
              />
            </label>
          )}
          <p>
            {tr(
              "محرر بيانات منظم. لا تنشر أي موعد أو قائمة أو نتيجة قبل التحقق منها.",
            )}
          </p>
          {tab === "more" && (
            <label>
              {tr("نوع البيانات")}
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setJson("");
                }}
              >
                {MORE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {tr(KIND_LABELS[k] || k)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="controls">
            <button
              onClick={() => setJson(JSON.stringify(template[kind], null, 2))}
            >
              {tr("سجل جديد")}
            </button>
            {records
              .filter((r) => r.kind === kind)
              .map((r, i) => (
                <button
                  key={i}
                  onClick={() => setJson(JSON.stringify(r.value, null, 2))}
                >
                  {String(
                    r.value.name ||
                      r.value.title ||
                      r.value.id ||
                      tr("الإعدادات"),
                  )}
                </button>
              ))}
          </div>
          {json && (
            <div className="editor-fields">
              {Object.entries(draft)
                .filter(
                  ([key, v]) =>
                    !["version", "updatedAt", "periods"].includes(key) &&
                    (["string", "number", "boolean"].includes(typeof v) ||
                      (Array.isArray(v) &&
                        v.every((x) => typeof x === "string"))),
                )
                .map(([key, v]) => (
                  <label key={key}>
                    {tr(
                      (
                        {
                          id: "المعرّف",
                          name: "الاسم",
                          country: "الدولة",
                          group: "المجموعة",
                          home: "الفريق الأول",
                          away: "الفريق الثاني",
                          date: "موعد المباراة مع المنطقة الزمنية",
                          venue: "المكان",
                          title: "العنوان",
                          slug: "رابط الخبر",
                          excerpt: "المقدمة",
                          content: "المحتوى",
                          streamUrl: "رابط البث المباشر (HTTPS)",
                          titleEn: "العنوان (English)",
                          excerptEn: "المقدمة (English)",
                          contentEn: "المحتوى (English)",
                          textEn: "النص (English)",
                          author: "الكاتب",
                          publishedAt: "تاريخ النشر",
                          status: "الحالة",
                          team: "الفريق",
                          number: "الرقم",
                          position: "المركز",
                          verified: "تم التحقق",
                          hero: "عنوان الرئيسية",
                          announcement: "الإعلان",
                          rulesConfirmed: "تم اعتماد قواعد البطولة",
                          qualificationSlots: "عدد المتأهلين",
                          start: "بداية البطولة",
                          end: "نهاية البطولة",
                          timezone: "المنطقة الزمنية",
                          groups: "المجموعات (مفصولة بفواصل)",
                          featuredGameId: "معرّف المباراة المميزة",
                        } as Record<string, string>
                      )[key] || key,
                    )}
                    {typeof v === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={v}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              { ...draft, [key]: e.target.checked },
                              null,
                              2,
                            ),
                          )
                        }
                      />
                    ) : ["home", "away", "team"].includes(key) ? (
                      <select
                        value={String(v)}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              { ...draft, [key]: e.target.value },
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        {data.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : key === "status" ? (
                      <select
                        value={String(v)}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              { ...draft, [key]: e.target.value },
                              null,
                              2,
                            ),
                          )
                        }
                      >
                        {(kind === "news"
                          ? ["draft", "published"]
                          : ["Scheduled"]
                        ).map((st) => (
                          <option key={st}>{st}</option>
                        ))}
                      </select>
                    ) : [
                        "content",
                        "excerpt",
                        "contentEn",
                        "excerptEn",
                        "announcement",
                      ].includes(key) ? (
                      <textarea
                        value={String(v)}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              { ...draft, [key]: e.target.value },
                              null,
                              2,
                            ),
                          )
                        }
                        rows={key.startsWith("content") ? 8 : 3}
                      />
                    ) : (
                      <input
                        dir={
                          [
                            "id",
                            "slug",
                            "date",
                            "start",
                            "end",
                            "publishedAt",
                            "timezone",
                          ].includes(key)
                            ? "ltr"
                            : "auto"
                        }
                        type={typeof v === "number" ? "number" : "text"}
                        value={Array.isArray(v) ? v.join(",") : String(v)}
                        onChange={(e) =>
                          setJson(
                            JSON.stringify(
                              {
                                ...draft,
                                [key]: Array.isArray(v)
                                  ? e.target.value
                                      .split(",")
                                      .map((x) => x.trim())
                                  : typeof v === "number"
                                    ? Number(e.target.value)
                                    : e.target.value,
                              },
                              null,
                              2,
                            ),
                          )
                        }
                      />
                    )}
                  </label>
                ))}
            </div>
          )}
          <button
            className="primary"
            disabled={!json}
            onClick={() => {
              try {
                void mutate({ action: "save", kind, value: JSON.parse(json) });
              } catch {
                setError(tr("JSON غير صالح"));
              }
            }}
          >
            {tr("تحقق واحفظ")}
          </button>
          <p className="muted">
            {tr(
              "المباريات الموجودة تُدار من التحكم المباشر. المجموعات والتأهل والمحتوى ضمن «الإعدادات وأخرى»، وإحصاءات اللاعبين تجدها هناك أيضًا.",
            )}
          </p>
        </>
      )}
      {tab === "security" && me && (
        <SecurityPanel
          me={me}
          setup={setup}
          codes={codes}
          busy={busy}
          lang={lang === "ar" ? "ar" : "en"}
          error=""
          onRun={(body) => void mutate(body)}
        />
      )}
      {tab === "users" && me && has("users:manage") && (
        <UsersPanel
          users={users}
          meId={me.id}
          busy={busy}
          lang={lang === "ar" ? "ar" : "en"}
          onRun={(body) => void mutate(body)}
        />
      )}
      {tab === "health" && (
        <>
          <h2>{tr("مصادر البيانات")}</h2>
          {[
            {
              name: "Manual",
              state: "HEALTHY · " + tr("المصدر الحالي"),
              note: tr("قاعدة البيانات المحلية · لا مزامنة خارجية"),
            },
            {
              name: "FIBA",
              state: fiba
                ? fiba.status.toUpperCase() + " · " + tr("مزامنة دورية")
                : "NOT_CONFIGURED",
              note: fiba
                ? tr("آخر مزامنة") +
                  " " +
                  new Date(fiba.finished).toLocaleString(
                    lang === "ar" ? "ar-LY" : "en-GB",
                  ) +
                  (fiba.error ? " · " + fiba.error : "")
                : tr("لم تُجرَ مزامنة بعد"),
            },
            {
              name: "FIBA LiveStats",
              state: "NOT_CONFIGURED",
              note: tr("بانتظار صلاحية الوصول من الجهة المنظِّمة"),
            },
          ].map(({ name, state, note }) => (
            <div className="health-row" key={name}>
              <b>{name}</b>
              <span>{state}</span>
              <span>{note}</span>
            </div>
          ))}
          <h3>{tr("جودة البيانات")}</h3>
          {data.teams
            .filter((t) => !t.verified)
            .map((t) => (
              <p key={t.id}>
                {tr("كتابة الاسم غير مؤكَّدة")} · {t.name}
              </p>
            ))}
          {data.games
            .filter((g) => stale(g))
            .map((g) => (
              <p key={g.id}>
                STALE · {g.id} · {tr("آخر تحديث")} {g.updatedAt}
              </p>
            ))}
          <p>
            {tr(
              "عتبة تأخر البيانات المباشرة: 45 ثانية. لا يوجد مصدر خارجي نشط أو تعارض مصادر حالي.",
            )}
          </p>
        </>
      )}
      {tab === "audit" && (
        <div className="audit">
          {audit.map((a, i) => {
            const action = String(a.action || "historical");
            const changes = auditChanges(a);
            const when = new Date(String(a.time));
            return (
              <details key={i} className={"audit-item audit-" + action}>
                <summary>
                  <span className="audit-badge">
                    {tr(AUDIT_ACTIONS[action] || action)}
                  </span>
                  <b className="audit-kind">
                    {tr(AUDIT_KINDS[String(a.kind)] || String(a.kind))}
                  </b>
                  <span className="audit-target" dir="ltr">
                    {String(a.target)}
                  </span>
                  <span className="audit-meta">
                    {tr(AUDIT_ACTORS[String(a.actor)] || String(a.actor))} ·{" "}
                    {Number.isNaN(when.getTime())
                      ? String(a.time)
                      : when.toLocaleString(lang === "ar" ? "ar-LY" : "en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                  </span>
                </summary>
                {a.reason ? (
                  <p>
                    {tr("سبب التصحيح")}: {String(a.reason)}
                  </p>
                ) : null}
                {changes.length > 0 && (
                  <ul className="audit-changes">
                    {changes.map((c) => (
                      <li key={c.key}>
                        <b dir="ltr">{c.key}</b>
                        <span className="audit-from" dir="auto">
                          {c.from}
                        </span>
                        <span aria-hidden="true">←</span>
                        <span className="audit-to" dir="auto">
                          {c.to}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <details className="audit-raw">
                  <summary>{tr("التفاصيل التقنية")}</summary>
                  <pre dir="ltr">
                    {JSON.stringify(
                      {
                        old: a.old ? JSON.parse(String(a.old)) : null,
                        new: a.new ? JSON.parse(String(a.new)) : null,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
