import type { Metadata } from "next";
import Link from "next/link";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import {
  PublicAuthForm,
  type PublicAuthState,
} from "@/components/public/PublicAuthForm";

export const metadata: Metadata = {
  title: `${ru.pages.signIn.title} — ${ru.studio.name}`,
};

interface SignInPageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const sp = await searchParams;
  const callbackUrl = sp.callbackUrl?.startsWith("/")
    ? sp.callbackUrl
    : "/account";

  async function action(
    _prev: PublicAuthState,
    formData: FormData,
  ): Promise<PublicAuthState> {
    "use server";
    try {
      await signIn("user-credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: callbackUrl,
      });
      return undefined;
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        typeof (err as { digest?: unknown }).digest === "string" &&
        ((err as { digest: string }).digest as string).startsWith(
          "NEXT_REDIRECT",
        )
      ) {
        throw err;
      }
      if (err instanceof AuthError) {
        if (err.type === "CredentialsSignin") {
          return { error: ru.pages.signIn.invalid };
        }
        return { error: ru.pages.signIn.generic };
      }
      throw err;
    }
  }

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
          {ru.pages.signIn.title}
        </h1>
        <p className="mt-3 text-sm text-mute">{ru.pages.signIn.lead}</p>

        <div className="mt-8">
          <PublicAuthForm mode="signIn" action={action} />
        </div>
      </div>
    </main>
  );
}
