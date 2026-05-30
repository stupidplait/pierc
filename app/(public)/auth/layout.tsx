import type { ReactNode } from "react";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";

/**
 * Auth subtree layout.
 *
 * The global header now comes from the parent `(public)/layout.tsx` (the
 * landing header), so auth pages just need the grid <AuthBackdrop /> and no
 * footer chrome competing against it. The footer is a direct `body` child
 * (the (public) layout is a Fragment), so a scoped style suppresses it.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`body > footer { display: none !important; } body { overflow-x: hidden; }`}</style>
      <AuthBackdrop />
      {children}
    </>
  );
}
