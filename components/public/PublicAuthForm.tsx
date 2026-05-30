"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { PhoneInput } from "@/components/ui/PhoneInput";

export type PublicAuthState = { error?: string } | undefined;

interface PublicAuthFormProps {
  mode: "signIn" | "signUp";
  action: (state: PublicAuthState, formData: FormData) => Promise<PublicAuthState>;
}

export function PublicAuthForm({ mode, action }: PublicAuthFormProps) {
  const [state, formAction, pending] = useActionState<PublicAuthState, FormData>(
    action,
    undefined,
  );

  const isSignUp = mode === "signUp";
  const t = isSignUp ? ru.pages.signUp : ru.pages.signIn;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {isSignUp ? (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">
            {ru.pages.signUp.nameLabel}
          </span>
          <input
            type="text"
            name="name"
            required
            autoComplete="name"
            placeholder={ru.pages.signUp.namePlaceholder}
            className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">
          {isSignUp ? ru.pages.signUp.emailLabel : ru.pages.signIn.emailLabel}
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder={isSignUp ? ru.pages.signUp.emailPlaceholder : ru.pages.signIn.emailPlaceholder}
          className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">
          {isSignUp ? ru.pages.signUp.passwordLabel : ru.pages.signIn.passwordLabel}
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete={isSignUp ? "new-password" : "current-password"}
          minLength={isSignUp ? 8 : undefined}
          placeholder={isSignUp ? ru.pages.signUp.passwordPlaceholder : ru.pages.signIn.passwordPlaceholder}
          className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        {isSignUp ? (
          <span className="text-xs text-mute">{ru.pages.signUp.passwordHint}</span>
        ) : null}
      </label>

      {isSignUp ? (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">
            {ru.pages.signUp.phoneLabel}
          </span>
          <PhoneInput
            name="phone"
            autoComplete="tel"
            placeholder={ru.pages.signUp.phonePlaceholder ?? ru.pages.account.phonePlaceholder}
            className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
          />
          <span className="text-xs text-mute">{ru.pages.signUp.phoneHint}</span>
        </label>
      ) : null}

      {state?.error ? (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-error/40 bg-error-soft px-4 py-3 text-sm text-error"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[13px] font-medium tracking-[0.04em] text-bg transition-colors hover:bg-ink/90 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg outline-none disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? t.submitting : t.submit}
      </button>

      {isSignUp ? (
        <p className="text-center text-xs text-mute">
          {ru.pages.signUp.guestUpgradeHint}
        </p>
      ) : null}

      <p className="mt-2 text-center text-sm text-mute">
        {isSignUp ? ru.pages.signUp.already : ru.pages.signIn.noAccount}{" "}
        <Link
          href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
          className="font-medium text-ink underline-offset-4 transition-colors hover:text-accent hover:underline"
        >
          {isSignUp ? ru.pages.signUp.signInLink : ru.pages.signIn.signUpLink}
        </Link>
      </p>
    </form>
  );
}
