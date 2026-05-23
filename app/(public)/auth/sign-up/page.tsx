import type { Metadata } from "next";
import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { PublicAuthForm } from "@/components/public/PublicAuthForm";
import { signUpAction } from "@/lib/user/auth-actions";

export const metadata: Metadata = {
  title: `${ru.pages.signUp.title} — ${ru.studio.name}`,
};

export default function SignUpPage() {
  return (
    <main className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-display text-xl font-medium tracking-tight text-ink"
        >
          {ru.studio.name}
        </Link>

        <h1 className="mt-8 font-display text-3xl font-medium text-ink sm:text-4xl">
          {ru.pages.signUp.title}
        </h1>
        <p className="mt-3 text-sm text-mute">{ru.pages.signUp.lead}</p>

        <div className="mt-8">
          <PublicAuthForm mode="signUp" action={signUpAction} />
        </div>
      </div>
    </main>
  );
}
