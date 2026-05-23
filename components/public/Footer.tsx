import Link from "next/link";
import { ru } from "@/lib/i18n/ru";
import { getSettings } from "@/lib/public/queries";

export async function Footer() {
  const settings = await getSettings();
  const year = new Date().getFullYear();

  const email = settings?.contactEmail;
  const phone = settings?.contactPhone;
  const address = settings?.contactAddress;
  const hours = settings?.workingHoursHint;
  const instagram = settings?.instagramUrl;
  const telegram = settings?.telegramUrl;

  return (
    <footer className="mt-24 border-t border-line bg-card/50">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 sm:grid-cols-3 sm:px-8">
        <div>
          <Link
            href="/"
            className="font-display text-2xl font-medium tracking-tight text-ink"
          >
            {ru.studio.name}
          </Link>
          <p className="mt-3 max-w-xs text-sm text-mute">
            {ru.footer.tagline}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
            {ru.footer.contactsHeading}
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-ink">
            <li>{address ?? "–"}</li>
            <li>
              {email ? (
                <a href={`mailto:${email}`} className="hover:text-primary">
                  {email}
                </a>
              ) : (
                <span className="text-mute">–</span>
              )}
            </li>
            <li>
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s|\(|\)|-/g, "")}`}
                  className="hover:text-primary"
                >
                  {phone}
                </a>
              ) : (
                <span className="text-mute">–</span>
              )}
            </li>
          </ul>
          <h2 className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-mute">
            {ru.footer.hoursHeading}
          </h2>
          <p className="mt-3 text-sm text-ink">{hours ?? "–"}</p>
        </div>

        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
            {ru.footer.socialHeading}
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              {instagram ? (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink hover:text-primary"
                >
                  {ru.footer.instagramLabel}
                </a>
              ) : (
                <span className="text-mute">{ru.footer.instagramLabel}</span>
              )}
            </li>
            <li>
              {telegram ? (
                <a
                  href={telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink hover:text-primary"
                >
                  {ru.footer.telegramLabel}
                </a>
              ) : (
                <span className="text-mute">{ru.footer.telegramLabel}</span>
              )}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-mute sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {year} {ru.studio.name}. {ru.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
