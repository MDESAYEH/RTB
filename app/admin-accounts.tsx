"use client";
import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import { roles, roleLabels, type Role, type Permission } from "@/lib/permissions";
import { useLang } from "./i18n";

export type Me = {
  id: string;
  identifier: string | null;
  role: string;
  permissions: Permission[];
  twoFactor: { enabled: boolean; required: boolean; available: boolean };
};
export type UserRow = {
  id: string;
  identifier: string | null;
  role: string;
  disabled: number;
  twoFactor: number;
};
export type Setup = { secret: string; qr: string };
type Run = (body: Record<string, unknown>) => void;

/** Password input with a show/hide eye button. */
export function PasswordField({
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
  required = true,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  autoFocus?: boolean;
}) {
  const { lang } = useLang();
  const [show, setShow] = useState(false);
  const label =
    lang === "ar"
      ? show
        ? "إخفاء كلمة المرور"
        : "إظهار كلمة المرور"
      : show
        ? "Hide password"
        : "Show password";
  return (
    <span className="password-field">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        required={required}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={label}
        aria-pressed={show}
        title={label}
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
}

const initial = (text: string) =>
  (text.replace(/^[+@\s]+/, "")[0] ?? "?").toUpperCase();

export function UsersPanel({
  users,
  meId,
  busy,
  lang,
  onRun,
}: {
  users: UserRow[];
  meId: string;
  busy: boolean;
  lang: "ar" | "en";
  onRun: Run;
}) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const descriptions: Record<Role, [string, string]> = {
    owner: [
      "كل الصلاحيات، وإدارة الحسابات والأدوار.",
      "Everything, including managing accounts and roles.",
    ],
    manager: [
      "يدير البطولة كاملة (المباريات والأندية والإعدادات والمحتوى والتصحيحات) دون إدارة الحسابات.",
      "Runs the whole tournament (matches, clubs, settings, content, corrections) without managing accounts.",
    ],
    editor: [
      "الأخبار واللاعبون والإحصاءات ورفع الصور فقط.",
      "News, players, stats and image uploads only.",
    ],
    scorer: [
      "غرفة التحكم المباشر فقط: النتيجة والوقت وحالة المباراة.",
      "Live control room only: score, clock and match status.",
    ],
  };
  return (
    <section className="admin-users">
      <header className="admin-section-head">
        <h2>{t("المستخدمون والصلاحيات", "Users and roles")}</h2>
        <p>
          {t(
            "أضف فريق العمل وحدّد ما يستطيع كل شخص فعله داخل لوحة الإدارة.",
            "Add your team and choose what each person can do in the admin area.",
          )}
        </p>
      </header>

      <form
        className="admin-card admin-user-form"
        onSubmit={(e) => {
          e.preventDefault();
          onRun({ action: "user:create", identifier, password, role });
          setPassword("");
          setIdentifier("");
        }}
      >
        <h3>{t("إضافة مستخدم", "Add a user")}</h3>
        <div className="admin-form-grid">
          <label>
            {t("البريد الإلكتروني أو رقم الهاتف", "Email or phone")}
            <input
              className="admin-field-ltr"
              dir="ltr"
              autoComplete="off"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </label>
          <label>
            {t("كلمة مرور مؤقتة (14 حرفاً على الأقل)", "Temporary password (14+ characters)")}
            <PasswordField
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={14}
            />
          </label>
          <label>
            {t("الدور", "Role")}
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r][lang]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="primary" disabled={busy}>
          {t("إضافة مستخدم", "Add user")}
        </button>
      </form>

      <ul className="admin-user-list">
        {users.map((u) => (
          <li
            key={u.id}
            className={"admin-card admin-user" + (u.disabled ? " is-disabled" : "")}
          >
            <span className="admin-avatar" aria-hidden="true">
              {initial(u.identifier ?? u.id)}
            </span>
            <div className="admin-user-main">
              <b dir="ltr">{u.identifier ?? u.id}</b>
              <span className="admin-badges">
                <i className={"pill role-" + u.role}>
                  {roleLabels[u.role as Role]?.[lang] ?? u.role}
                </i>
                {u.id === meId && <i className="pill pill-you">{t("أنت", "You")}</i>}
                {u.disabled ? <i className="pill pill-off">{t("معطّل", "Disabled")}</i> : null}
                {u.twoFactor ? (
                  <i className="pill pill-ok">
                    <Check size={12} aria-hidden="true" /> {t("تحقق ثنائي", "2FA")}
                  </i>
                ) : (
                  <i className="pill pill-warn">{t("بدون تحقق ثنائي", "No 2FA")}</i>
                )}
              </span>
            </div>
            <div className="admin-user-actions">
              <select
                aria-label={t("الدور", "Role")}
                value={u.role}
                disabled={busy}
                onChange={(e) =>
                  onRun({ action: "user:role", id: u.id, role: e.target.value })
                }
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r][lang]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onRun({ action: u.disabled ? "user:enable" : "user:disable", id: u.id })
                }
              >
                {u.disabled ? t("تفعيل", "Enable") : t("تعطيل", "Disable")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setResetId(resetId === u.id ? null : u.id);
                  setResetPw("");
                }}
              >
                <KeyRound size={14} aria-hidden="true" /> {t("كلمة المرور", "Password")}
              </button>
              {u.twoFactor ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        t(
                          "إلغاء التحقق الثنائي لهذا الحساب؟ سيُسجَّل خروجه ويُطلب منه إعداده من جديد.",
                          "Remove this account's authenticator? They will be signed out and must set it up again.",
                        ),
                      )
                    )
                      onRun({ action: "user:2fa-reset", id: u.id });
                  }}
                >
                  {t("إعادة تعيين 2FA", "Reset 2FA")}
                </button>
              ) : null}
              <button
                type="button"
                className="danger"
                disabled={busy}
                aria-label={t("حذف", "Delete")}
                title={t("حذف", "Delete")}
                onClick={() => {
                  if (
                    window.confirm(
                      t("حذف هذا الحساب نهائياً؟", "Delete this account permanently?"),
                    )
                  )
                    onRun({ action: "user:delete", id: u.id });
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
            {resetId === u.id && (
              <form
                className="admin-reset"
                onSubmit={(e) => {
                  e.preventDefault();
                  onRun({ action: "user:password", id: u.id, password: resetPw });
                  setResetId(null);
                  setResetPw("");
                }}
              >
                <label>
                  {t(
                    "كلمة المرور الجديدة (14 حرفاً على الأقل). سيُسجَّل خروج المستخدم من كل الجلسات.",
                    "New password (14+ characters). The user will be signed out everywhere.",
                  )}
                  <PasswordField
                    value={resetPw}
                    onChange={setResetPw}
                    autoComplete="new-password"
                    minLength={14}
                    autoFocus
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {t("حفظ", "Save")}
                </button>
                <button type="button" onClick={() => setResetId(null)}>
                  {t("إلغاء", "Cancel")}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      <h3 className="admin-subhead">{t("ماذا يستطيع كل دور؟", "What can each role do?")}</h3>
      <div className="admin-role-grid">
        {roles.map((r) => (
          <div className="admin-card admin-role-card" key={r}>
            <i className={"pill role-" + r}>{roleLabels[r][lang]}</i>
            <p>{descriptions[r][lang === "ar" ? 0 : 1]}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SecurityPanel({
  me,
  setup,
  codes,
  busy,
  lang,
  forced,
  error,
  onRun,
}: {
  me: Me;
  setup: Setup | null;
  codes: string[] | null;
  busy: boolean;
  lang: "ar" | "en";
  forced?: boolean;
  error: string;
  onRun: Run;
}) {
  const t = (ar: string, en: string) => (lang === "ar" ? ar : en);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const enabled = me.twoFactor.enabled;
  return (
    <section className="admin-security">
      <header className="admin-section-head">
        <h2>{t("حماية الحساب", "Account security")}</h2>
        <p>
          {t(
            "طبقة ثانية للدخول: رمز من تطبيق المصادقة في هاتفك بعد كلمة المرور.",
            "A second layer at sign-in: a code from the authenticator app on your phone after your password.",
          )}
        </p>
      </header>
      {forced && (
        <p className="admin-callout" role="status">
          {t(
            "للمتابعة يلزم تفعيل التحقق الثنائي. سيُطلب الرمز في كل مرة تسجّل فيها الدخول.",
            "Two-factor authentication is required to continue. You will be asked for a code every time you sign in.",
          )}
        </p>
      )}
      {error && forced && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      {codes && (
        <div className="admin-card admin-recovery" role="status">
          <h3>{t("رموز الاسترداد", "Recovery codes")}</h3>
          <p>
            {t(
              "احفظها الآن في مكان آمن. كل رمز يعمل مرة واحدة إذا ضاع هاتفك، ولن تظهر مرة أخرى.",
              "Save them now somewhere safe. Each works once if you lose your phone, and they will not be shown again.",
            )}
          </p>
          <ul dir="ltr">
            {codes.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {enabled ? (
        <>
          <div className="admin-card admin-2fa-on">
            <span className="admin-2fa-icon" aria-hidden="true">
              <ShieldCheck size={26} />
            </span>
            <div>
              <h3>{t("التحقق الثنائي مفعَّل", "Two-factor is on")}</h3>
              <p>
                {t(
                  "حسابك محمي برمز من تطبيق المصادقة عند كل دخول.",
                  "Your account asks for an authenticator code at every sign-in.",
                )}
              </p>
            </div>
          </div>
          <details className="admin-card admin-2fa-off">
            <summary>{t("إيقاف التحقق الثنائي", "Turn off two-factor")}</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onRun({ action: "2fa:disable", password, otp: code });
                setPassword("");
                setCode("");
              }}
            >
              <div className="admin-form-grid">
                <label>
                  {t("كلمة المرور", "Password")}
                  <PasswordField value={password} onChange={setPassword} />
                </label>
                <label>
                  {t("رمز التحقق أو رمز استرداد", "Authenticator or recovery code")}
                  <input
                    className="admin-field-ltr"
                    dir="ltr"
                    autoComplete="one-time-code"
                    maxLength={12}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </label>
              </div>
              <button className="danger-solid" disabled={busy}>
                {t("إيقاف", "Turn off")}
              </button>
            </form>
          </details>
        </>
      ) : !me.twoFactor.available ? (
        <p className="admin-error" role="alert">
          {t(
            "التحقق الثنائي غير مهيّأ على الخادم بعد (يلزم ضبط TWO_FACTOR_KEY). تواصل مع مسؤول الخادم.",
            "Two-factor is not configured on the server yet (TWO_FACTOR_KEY is missing). Ask the server administrator.",
          )}
        </p>
      ) : setup ? (
        <div className="admin-2fa-steps">
          <div className="admin-card admin-step">
            <span className="admin-step-no">1</span>
            <div>
              <h3>{t("امسح الرمز", "Scan the code")}</h3>
              <p>
                {t(
                  "افتح Google Authenticator أو Microsoft Authenticator أو Authy، وامسح رمز QR:",
                  "Open Google Authenticator, Microsoft Authenticator or Authy and scan the QR code:",
                )}
              </p>
              {/* A QR image generated by the server as a data URL. */}
              <img
                src={setup.qr}
                width={220}
                height={220}
                alt={t("رمز QR لإعداد التحقق الثنائي", "QR code to set up two-factor")}
              />
              <p className="admin-manual-key">
                {t("أو أدخل المفتاح يدوياً:", "Or enter this key manually:")}{" "}
                <code dir="ltr">{setup.secret}</code>
              </p>
            </div>
          </div>
          <form
            className="admin-card admin-step"
            onSubmit={(e) => {
              e.preventDefault();
              onRun({ action: "2fa:confirm", otp: code });
              setCode("");
            }}
          >
            <span className="admin-step-no">2</span>
            <div>
              <h3>{t("أكّد الرمز", "Confirm the code")}</h3>
              <label>
                {t("اكتب الرمز المكوّن من 6 أرقام الظاهر في التطبيق", "Enter the 6-digit code shown in the app")}
                <input
                  className="admin-field-ltr"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                {t("تأكيد وتفعيل", "Confirm and turn on")}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="admin-card admin-2fa-start">
          <span className="admin-2fa-icon" aria-hidden="true">
            <ShieldCheck size={26} />
          </span>
          <div>
            <h3>{t("التحقق الثنائي غير مفعَّل", "Two-factor is off")}</h3>
            <p>
              {t(
                "فعّله ليُطلب منك رمز من التطبيق عند كل دخول.",
                "Turn it on to be asked for an app code at every sign-in.",
              )}
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => onRun({ action: "2fa:begin" })}
            >
              {t("تفعيل التحقق الثنائي", "Turn on two-factor")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
