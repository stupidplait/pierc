"use client";

import { useActionState } from "react";
import { ru } from "@/lib/i18n/ru";

export type LoginState = { error?: string } | undefined;

interface LoginFormProps {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink">
          {ru.admin.login.emailLabel}
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
          {ru.admin.login.passwordLabel}
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
        />
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
        {pending ? ru.admin.login.submitting : ru.admin.login.submit}
      </button>
    </form>
  );
}
