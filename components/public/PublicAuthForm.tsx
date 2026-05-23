"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ru } from "@/lib/i18n/ru";

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
          className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        {isSignUp ? (
          <span className="text-xs text-mute">{ru.pages.signUp.passwordHint}</span>
        ) : null}
      </label>

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
        className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 font-medium text-on-primary transition-colors hover:bg-primary-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page outline-none disabled:opacity-50"
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
          className="text-primary hover:underline"
        >
          {isSignUp ? ru.pages.signUp.signInLink : ru.pages.signIn.signUpLink}
        </Link>
      </p>
    </form>
  );
}
