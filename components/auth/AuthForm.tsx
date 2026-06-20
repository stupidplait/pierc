"use client";

import {
  useActionState,
  useId,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AnimatePresence,
  m,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { blurRevealVariants } from "@/components/motion/BlurReveal";
import {
  ENTRANCE_DURATION,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/motion/entrance";
import {
  validateAuthField,
  type AuthFieldName,
} from "@/lib/auth/auth-schema";

export type AuthFormState = { error?: string } | undefined;

interface AuthFormProps {
  mode: "signIn" | "signUp";
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}

// ─── Password strength (sign-up only) ──────────────────────────────────────
// A coarse 1–3 score driving the segmented meter. Length is the dominant
// factor (<8 is always weak, matching the zod min(8) rule); a letter+digit mix
// and either length ≥12 or a symbol each add a step. Unicode-aware (\p{L}) so
// Cyrillic letters count. Pure — derived in render, never stored in an effect.
function scorePassword(pw: string): 1 | 2 | 3 {
  if (pw.length < 8) return 1;
  let s = 1;
  if (/\d/u.test(pw) && /\p{L}/u.test(pw)) s += 1;
  if (pw.length >= 12 || /[^\p{L}\d]/u.test(pw)) s += 1;
  return Math.min(3, s) as 1 | 2 | 3;
}

const STRENGTH_COLOR: Record<1 | 2 | 3, string> = {
  1: "var(--error)",
  2: "#f5b14b",
  3: "#34d399",
};

const inputBase =
  "h-11 w-full rounded-xl border bg-page px-4 text-ink outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-2";

/**
 * BlurSwap — blur-reveals its content on mount and whenever `swapKey` changes,
 * old text blurring out before the new blurs in (mode="wait"). Used for the
 * submit-button label and the mode-switch caption: because the card persists and
 * morphs between sign-in and sign-up, those two read as shared elements, so
 * their *text* should resolve in via the house blur entrance instead of
 * hard-cutting (and the button label also blurs as it enters its pending state).
 * Reduced motion renders the content statically.
 */
function BlurSwap({
  swapKey,
  reduce,
  className,
  children,
}: {
  swapKey: string;
  reduce: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (reduce) return <span className={className}>{children}</span>;
  return (
    <AnimatePresence mode="wait">
      <m.span
        key={swapKey}
        initial={{ opacity: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(6px)" }}
        transition={{ duration: 0.22, ease: REVEAL_EASE }}
        className={className}
      >
        {children}
      </m.span>
    </AnimatePresence>
  );
}

/**
 * ErrorText — cross-fades an error message in place when it changes, without
 * touching the row height. `mode="popLayout"` pops the outgoing text to absolute
 * so the incoming text holds the row's height steady (no blip), and
 * `initial={false}` means the *first* appearance doesn't animate here — the
 * grid-rows row reveal carries that. Reduced motion renders the text plainly.
 */
function ErrorText({ text, reduce }: { text: string; reduce: boolean }) {
  if (reduce) return <>{text}</>;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <m.span
        key={text}
        initial={{ opacity: 0, filter: "blur(5px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(5px)" }}
        transition={{ duration: 0.18, ease: REVEAL_EASE }}
        className="block"
      >
        {text}
      </m.span>
    </AnimatePresence>
  );
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    undefined,
  );

  const isSignUp = mode === "signUp";
  const t = isSignUp ? ru.pages.signUp : ru.pages.signIn;
  const tf = ru.pages.authForm;

  const reduce = useReducedMotion();
  const uid = useId();
  const errId = (f: AuthFieldName) => `${uid}-${f}-err`;

  const [errors, setErrors] = useState<Partial<Record<AuthFieldName, string>>>({});
  // Sticky copy of the last message shown per field. `errors` is deleted the
  // moment a field becomes valid, but the error row needs to keep rendering its
  // text while it collapses — so display reads from here, which is only ever
  // updated to a non-empty message.
  const [errorText, setErrorText] = useState<Partial<Record<AuthFieldName, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<AuthFieldName, boolean>>>({});
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  const fields: AuthFieldName[] = isSignUp
    ? ["name", "email", "password", "phone"]
    : ["email", "password"];

  function applyError(field: AuthFieldName, msg: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });
    if (msg) setErrorText((prev) => ({ ...prev, [field]: msg }));
  }

  function validate(field: AuthFieldName, value: string) {
    applyError(field, validateAuthField(mode, field, value));
  }

  const onBlur = (field: AuthFieldName) => (e: FocusEvent<HTMLInputElement>) => {
    setTouched((p) => ({ ...p, [field]: true }));
    validate(field, e.currentTarget.value);
  };

  const onChange = (field: AuthFieldName) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value;
    if (field === "password") setPassword(v);
    // Re-validate only fields the user has already left once, so errors clear
    // live as they fix them but don't shout while they're still typing the
    // first time.
    if (touched[field]) validate(field, v);
  };

  function onCapsKey(e: KeyboardEvent<HTMLInputElement>) {
    setCapsOn(e.getModifierState?.("CapsLock") ?? false);
  }

  // Gate the React form action behind a full zod pass. With JS on, an invalid
  // submit is cancelled here and the first bad field is focused; with JS off the
  // form still POSTs and the server action (same schemas) is the real guard.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const fd = new FormData(form);
    const nextErrors: Partial<Record<AuthFieldName, string>> = {};
    let firstInvalid: AuthFieldName | null = null;
    for (const f of fields) {
      const msg = validateAuthField(mode, f, String(fd.get(f) ?? ""));
      if (msg) {
        nextErrors[f] = msg;
        firstInvalid ??= f;
      }
    }
    if (firstInvalid) {
      e.preventDefault();
      setErrors(nextErrors);
      setErrorText((prev) => ({ ...prev, ...nextErrors }));
      setTouched(Object.fromEntries(fields.map((f) => [f, true])));
      const el = form.elements.namedItem(firstInvalid);
      if (el instanceof HTMLElement) el.focus();
    }
  }

  function fieldCls(field: AuthFieldName) {
    const invalid = touched[field] && errors[field];
    return `${inputBase} ${
      invalid
        ? "border-error focus-visible:border-error focus-visible:ring-error/30"
        : "border-line hover:border-ink/30 focus-visible:border-primary focus-visible:ring-primary/30"
    }`;
  }

  const ariaProps = (field: AuthFieldName) => ({
    "aria-invalid": Boolean(touched[field] && errors[field]),
    "aria-describedby": touched[field] && errors[field] ? errId(field) : undefined,
  });

  // Per-field error line. The height is driven by a CSS grid-template-rows
  // 0fr↔1fr transition (reliable auto-height with no JS measuring) and the top
  // spacing (pt-2) lives INSIDE the clipped row — the row has no flex gap — so
  // when it collapses nothing is left behind to snap shut. The message is sticky
  // (errorText) so it stays visible as the row collapses; when only the message
  // changes the row stays open and the text cross-fades in place (ErrorText /
  // popLayout) instead of collapsing and re-expanding. The global reduced-motion
  // rule zeroes the CSS transition automatically.
  function renderError(field: AuthFieldName) {
    const open = Boolean(touched[field] && errors[field]);
    const text = errorText[field] ?? "";
    return (
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        aria-hidden={open ? undefined : true}
      >
        <div className="relative overflow-hidden">
          <span id={errId(field)} role="alert" className="block pt-2 text-xs text-error">
            <ErrorText text={text} reduce={Boolean(reduce)} />
          </span>
        </div>
      </div>
    );
  }

  // Mount stagger for the field rows — the house blur-focus, cascaded just after
  // the card surface lands (delayChildren). Disabled wholesale under reduced
  // motion so rows render in place.
  const containerMotion = reduce
    ? {}
    : {
        initial: "hidden" as const,
        animate: "show" as const,
        variants: {
          hidden: {},
          show: {
            transition: { staggerChildren: ENTRANCE_STAGGER, delayChildren: 0.12 },
          },
        },
      };
  const item = reduce ? undefined : blurRevealVariants;
  // Non-blur lift for rows whose *text* carries its own blur reveal (the submit
  // button + the switch caption), so those don't double-blur.
  const itemLift: Variants | undefined = reduce
    ? undefined
    : {
        hidden: { opacity: 0, scale: 0.98 },
        show: {
          opacity: 1,
          scale: 1,
          transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
        },
      };

  const strength = isSignUp && password.length > 0 ? scorePassword(password) : 0;
  const strengthLabel =
    strength === 3 ? tf.strengthStrong : strength === 2 ? tf.strengthMedium : tf.strengthWeak;

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate>
      <m.div {...containerMotion} className="flex flex-col gap-4">
        {isSignUp ? (
          <m.label variants={item} className="flex flex-col">
            <span className="mb-2 text-sm font-medium text-ink">{ru.pages.signUp.nameLabel}</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder={ru.pages.signUp.namePlaceholder}
              className={fieldCls("name")}
              onBlur={onBlur("name")}
              onChange={onChange("name")}
              {...ariaProps("name")}
            />
            {renderError("name")}
          </m.label>
        ) : null}

        <m.label variants={item} className="flex flex-col">
          <span className="mb-2 text-sm font-medium text-ink">{t.emailLabel}</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t.emailPlaceholder}
            className={fieldCls("email")}
            onBlur={onBlur("email")}
            onChange={onChange("email")}
            {...ariaProps("email")}
          />
          {renderError("email")}
        </m.label>

        <m.label variants={item} className="flex flex-col">
          <span className="mb-2 text-sm font-medium text-ink">{t.passwordLabel}</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              placeholder={t.passwordPlaceholder}
              className={`${fieldCls("password")} pr-12`}
              onChange={onChange("password")}
              onBlur={onBlur("password")}
              onKeyUp={onCapsKey}
              onKeyDown={onCapsKey}
              {...ariaProps("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? tf.hidePassword : tf.showPassword}
              aria-pressed={showPassword}
              className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-mute transition-colors hover:text-ink focus-visible:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {/* Strength meter — sign-up only, once typing starts. */}
          {isSignUp && password.length > 0 ? (
            <div className="mt-2">
              <div className="flex gap-1.5" aria-hidden>
                {[1, 2, 3].map((seg) => (
                  <span
                    key={seg}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-line"
                  >
                    <m.span
                      className="block h-full origin-left rounded-full"
                      style={{
                        background:
                          seg <= strength
                            ? STRENGTH_COLOR[strength as 1 | 2 | 3]
                            : "transparent",
                      }}
                      initial={false}
                      animate={{ scaleX: seg <= strength ? 1 : 0 }}
                      transition={
                        reduce ? { duration: 0 } : { duration: 0.3, ease: REVEAL_EASE }
                      }
                    />
                  </span>
                ))}
              </div>
              <p
                className="mt-1 text-xs"
                style={{ color: STRENGTH_COLOR[strength as 1 | 2 | 3] }}
              >
                {tf.strengthLabel}: {strengthLabel}
              </p>
            </div>
          ) : null}

          {/* Caps-Lock heads-up — only while it's on. Same grid-rows collapse as
              the error (top spacing inside the clipped row → no residual snap). */}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ gridTemplateRows: capsOn ? "1fr" : "0fr" }}
            aria-hidden={capsOn ? undefined : true}
          >
            <div className="overflow-hidden">
              <span className="block pt-2 text-xs text-mute">⇪ {tf.capsLock}</span>
            </div>
          </div>

          {isSignUp ? (
            <span className="mt-2 block text-xs text-mute">{ru.pages.signUp.passwordHint}</span>
          ) : null}
          {renderError("password")}
        </m.label>

        {isSignUp ? (
          <m.label variants={item} className="flex flex-col">
            <span className="mb-2 text-sm font-medium text-ink">{ru.pages.signUp.phoneLabel}</span>
            <PhoneInput
              name="phone"
              autoComplete="tel"
              placeholder={ru.pages.signUp.phonePlaceholder ?? ru.pages.account.phonePlaceholder}
              className={fieldCls("phone")}
            />
            <span className="mt-2 block text-xs text-mute">{ru.pages.signUp.phoneHint}</span>
          </m.label>
        ) : null}

        {/* Server-side error (auth failure / rate limit / taken email). */}
        {reduce ? (
          state?.error ? (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error"
            >
              <AlertIcon />
              <span>{state.error}</span>
            </div>
          ) : null
        ) : (
          <AnimatePresence>
            {state?.error ? (
              <m.div
                key={state.error}
                role="alert"
                aria-live="assertive"
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.2, ease: REVEAL_EASE }}
                className="flex items-start gap-2 rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error"
              >
                <AlertIcon />
                <span>{state.error}</span>
              </m.div>
            ) : null}
          </AnimatePresence>
        )}

        <m.div variants={itemLift}>
          <button
            type="submit"
            disabled={pending}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[13px] font-medium tracking-[0.04em] text-bg transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg outline-none disabled:opacity-50 disabled:pointer-events-none"
          >
            {pending ? <Spinner /> : null}
            <BlurSwap
              swapKey={pending ? t.submitting : t.submit}
              reduce={Boolean(reduce)}
              className="inline-block"
            >
              {pending ? t.submitting : t.submit}
            </BlurSwap>
          </button>
        </m.div>

        {isSignUp ? (
          <m.p variants={item} className="text-center text-xs text-mute">
            {ru.pages.signUp.guestUpgradeHint}
          </m.p>
        ) : null}

        <m.p variants={itemLift} className="mt-2 text-center text-sm text-mute">
          <BlurSwap swapKey={mode} reduce={Boolean(reduce)}>
            {isSignUp ? ru.pages.signUp.already : ru.pages.signIn.noAccount}{" "}
            <Link
              href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
              className="font-medium text-ink underline-offset-4 transition-colors hover:text-accent hover:underline"
            >
              {isSignUp ? ru.pages.signUp.signInLink : ru.pages.signIn.signUpLink}
            </Link>
          </BlurSwap>
        </m.p>
      </m.div>
    </form>
  );
}

// ─── Inline icons (no lucide dependency — avoids the Turbopack export quirk) ──

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.7 5.1A9.3 9.3 0 0 1 12 5c6.5 0 10 7 10 7a13.4 13.4 0 0 1-2.4 3.2M6.2 6.2A13.4 13.4 0 0 0 2 12s3.5 7 10 7a9.3 9.3 0 0 0 3.3-.6" />
      <path d="m9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0">
      <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
