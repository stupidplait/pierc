import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { Button } from "@/components/ui/Button";
import { NavLinks } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";
import { getCachedPublicUser } from "@/lib/public/queries";
import { signOutPublicAction } from "@/lib/user/auth-actions";

export async function Header() {
  const user = await getCachedPublicUser();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4 sm:px-8">
        <Link
          href="/"
          className="font-display text-xl font-medium tracking-tight text-ink"
          aria-label={`${ru.studio.name} — ${ru.nav.home}`}
        >
          {ru.studio.name}
        </Link>

        <NavLinks className="hidden items-center gap-6 text-sm font-medium md:flex" />

        <div className="flex items-center gap-1.5">
          {user ? (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/account"
                className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-ink transition-colors hover:text-primary"
                title={user.email}
              >
                {user.name || ru.nav.account}
              </Link>
              <form action={signOutPublicAction}>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-mute transition-colors hover:text-primary"
                >
                  {ru.nav.signOut}
                </button>
              </form>
            </div>
          ) : (
            <div className="hidden items-center gap-1 md:flex">
              <Link
                href="/auth/sign-in"
                className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-ink transition-colors hover:text-primary"
              >
                {ru.nav.signIn}
              </Link>
              <Link
                href="/auth/sign-up"
                className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-ink transition-colors hover:text-primary"
              >
                {ru.nav.signUp}
              </Link>
            </div>
          )}
          <Button href="/book" size="sm" className="hidden sm:inline-flex">
            {ru.nav.cta}
          </Button>
          <MobileMenu user={user} />
        </div>
      </div>
    </header>
  );
}
