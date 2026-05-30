import type { Metadata } from "next";
import { ru } from "@/lib/i18n/ru";
import { PublicAuthForm } from "@/components/public/PublicAuthForm";
import { AuthThemeFrame } from "@/components/landing/auth/AuthThemeFrame";
import { signUpAction } from "@/lib/user/auth-actions";

// Skip build-time prerender — transitively reads Settings via auth scaffolding.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${ru.pages.signUp.title} — ${ru.studio.name}`,
};

export default function SignUpPage() {
  return (
    <main
      className="
        relative z-10 min-h-[100svh]
        flex items-center justify-center
        px-4 py-24 sm:px-8
      "
    >
      <div
        className="
          w-full max-w-md
          rounded-2xl border border-line
          bg-card p-7
          shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(240,240,240,0.12)]
          sm:p-9
        "
      >
        <h1 className="font-display text-3xl font-medium leading-tight tracking-tight text-ink sm:text-4xl">
          {ru.pages.signUp.title}
        </h1>

        <p className="mt-3 text-sm text-mute">{ru.pages.signUp.lead}</p>

        <AuthThemeFrame className="mt-7">
          <PublicAuthForm mode="signUp" action={signUpAction} />
        </AuthThemeFrame>
      </div>
    </main>
  );
}
