import type { Metadata } from "next";
import { ru } from "@/lib/i18n/ru";
import {
  PublicAuthForm,
  type PublicAuthState,
} from "@/components/public/PublicAuthForm";
import { AuthThemeFrame } from "@/components/landing/auth/AuthThemeFrame";
import { runLogin } from "@/lib/auth-actions";

// Skip build-time prerender — transitively reads Settings via auth scaffolding.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${ru.pages.signIn.title} — ${ru.studio.name}`,
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const sp = await searchParams;
  // Customer destination after login. Admins always go to /admin (handled in
  // runLogin), regardless of callbackUrl.
  const callbackUrl = sp.callbackUrl?.startsWith("/")
    ? sp.callbackUrl
    : "/account";

  async function action(
    _prev: PublicAuthState,
    formData: FormData,
  ): Promise<PublicAuthState> {
    "use server";
    return runLogin(callbackUrl, formData);
  }

  return (
    <main
      className="
        app-auth
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
          {ru.pages.signIn.title}
        </h1>

        <p className="mt-3 text-sm text-mute">{ru.pages.signIn.lead}</p>

        <AuthThemeFrame className="mt-7">
          <PublicAuthForm mode="signIn" action={action} />
        </AuthThemeFrame>
      </div>
    </main>
  );
}
