import type { Metadata } from "next";
import { ru } from "@/lib/i18n/ru";
import { AuthForm, type AuthFormState } from "@/components/auth/AuthForm";
import { AuthCard } from "@/components/auth/AuthCard";
import { runLogin } from "@/lib/auth-actions";
import { safeInternalPath } from "@/lib/safe-redirect";

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
  // runLogin), regardless of callbackUrl. safeInternalPath rejects external /
  // protocol-relative ("//evil.com") values to prevent an open redirect.
  const callbackUrl = safeInternalPath(sp.callbackUrl, "/account");

  async function action(
    _prev: AuthFormState,
    formData: FormData,
  ): Promise<AuthFormState> {
    "use server";
    return runLogin(callbackUrl, formData);
  }

  // The centering <main> + the bordered card frame live in AuthShell (the auth
  // layout), so the card persists across sign-in ⇄ sign-up and morphs between
  // them; this page only supplies the panel content.
  return (
    <AuthCard title={ru.pages.signIn.title} lead={ru.pages.signIn.lead}>
      <AuthForm mode="signIn" action={action} />
    </AuthCard>
  );
}
