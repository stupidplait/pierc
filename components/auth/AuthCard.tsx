import type { ReactNode } from "react";
import { WordReveal } from "@/components/motion/WordReveal";
import { AuthThemeFrame } from "@/components/auth/AuthThemeFrame";

/**
 * AuthCard — the per-route *content* of the auth panel: the heading + the themed
 * form. The bordered, elevated card frame itself lives in {@link AuthShell} (the
 * auth layout), so it persists across the sign-in ⇄ sign-up navigation and can
 * morph its size between the two. This piece is what gets swapped inside it.
 *
 * The H1 reveals glyph-by-glyph and the lead word-by-word a beat later — the
 * same WordReveal used by the /services + /faq headers — and the form cascades
 * its own fields just after, so the page reads of a piece with the rest of the
 * site.
 */
export function AuthCard({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <>
      <WordReveal
        text={title}
        as="h1"
        splitBy="char"
        amount={0.6}
        className="font-display text-3xl font-medium leading-tight tracking-tight text-ink sm:text-4xl"
      />
      <WordReveal
        text={lead}
        as="p"
        delay={0.15}
        amount={0.6}
        className="mt-3 text-sm text-mute"
      />

      <AuthThemeFrame className="mt-7">{children}</AuthThemeFrame>
    </>
  );
}
