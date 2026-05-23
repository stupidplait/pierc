import type { Metadata } from "next";
import Link from "next/link";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";
import { LoginForm, type LoginState } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: `${ru.admin.login.title} — ${ru.studio.name}`,
};

async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  "use server";

  try {
    await signIn("admin-credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin",
    });
    return undefined;
  } catch (err) {
    // NextAuth always rethrows the framework redirect error; let it through.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      ((err as { digest: string }).digest as string).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }

    if (err instanceof AuthError) {
      // CredentialsSignin always means "invalid credentials" in our setup.
      if (err.type === "CredentialsSignin") {
        return { error: ru.admin.login.invalid };
      }
      return { error: ru.admin.login.generic };
    }

    throw err;
  }
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="font-display text-xl font-medium tracking-tight text-ink"
        >
          {ru.studio.name}
        </Link>

        <h1 className="mt-8 font-display text-3xl font-medium text-ink sm:text-4xl">
          {ru.admin.login.title}
        </h1>
        <p className="mt-3 text-sm text-mute">{ru.admin.login.lead}</p>

        <div className="mt-8">
          <LoginForm action={loginAction} />
        </div>
      </div>
    </main>
  );
}
