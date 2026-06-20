import type { Metadata } from "next";
import { ru } from "@/lib/i18n/ru";
import { AuthForm } from "@/components/auth/AuthForm";
import { AuthCard } from "@/components/auth/AuthCard";
import { signUpAction } from "@/lib/user/auth-actions";

// Skip build-time prerender — transitively reads Settings via auth scaffolding.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${ru.pages.signUp.title} — ${ru.studio.name}`,
};

export default function SignUpPage() {
  // The centering <main> + the bordered card frame live in AuthShell (the auth
  // layout), so the card persists across sign-in ⇄ sign-up and morphs between
  // them; this page only supplies the panel content.
  return (
    <AuthCard title={ru.pages.signUp.title} lead={ru.pages.signUp.lead}>
      <AuthForm mode="signUp" action={signUpAction} />
    </AuthCard>
  );
}
