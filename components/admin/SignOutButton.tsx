import { signOut } from "@/lib/auth";
import { ru } from "@/lib/i18n/ru";

// Server-action sign-out. Rendered as a real <form> so it works without
// JavaScript and survives a hard reload.
export function SignOutButton() {
  async function action() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <form action={action}>
      <button
        type="submit"
        className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-mute transition-colors hover:bg-card hover:text-primary"
      >
        {ru.admin.nav.signOut}
      </button>
    </form>
  );
}
