"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { motion, MotionConfig, type Variants } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { formatRuPhone, ruPhoneHref } from "@/lib/phone";
import { signOutPublicAction } from "@/lib/user/auth-actions";
import { disconnectTelegram, devToggleTelegram } from "@/lib/user/profile-actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditProfileDrawer } from "@/components/account/EditProfileDrawer";
import { AuthBackdrop } from "@/components/landing/auth/AuthBackdrop";
import { Section } from "@/components/ui/Section";
import { useIsApp } from "@/lib/hooks/useIsApp";
import {
  ENTRANCE_DURATION,
  ENTRANCE_HIDDEN,
  ENTRANCE_SHOW,
  ENTRANCE_STAGGER,
  REVEAL_EASE,
} from "@/components/services/entrance/config";
import { Feed } from "@/components/account/feed/Feed";
import { FeedHeading } from "@/components/account/feed/shared";
import type {
  AppointmentEntry,
  FeedItem,
  NextAppointment,
  StandaloneBooking,
} from "@/components/account/feed/types";

interface AccountViewProps {
  userName: string;
  email: string;
  phone: string | null;
  telegram: string | null;
  telegramConnected: boolean;
  telegramConnectUrl: string | null;
  dev?: boolean;
  appointments: AppointmentEntry[];
  standaloneBookings: StandaloneBooking[];
  nextAppointment: NextAppointment | null;
}

const t = ru.pages.account;

// Secondary pages that the website header carries but the native shell hides.
// Surfaced here (app mode only) so Профиль can reach them; see useIsApp().
const APP_LINKS: { href: string; label: string }[] = [
  { href: "/services", label: ru.nav.services },
  { href: "/gallery", label: ru.nav.gallery },
  { href: "/about", label: ru.nav.about },
  { href: "/faq", label: ru.nav.faq },
];

// Card surface shared with the rest of the public family (services / faq): a
// solid elevated panel with the same layered shadow as FeaturedServiceCard, so
// /account reads as one of the same set rather than a one-off glass dashboard.
const SURFACE =
  "rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(8,8,8,0.5),0_10px_28px_-10px_rgba(8,8,8,0.6)]";
const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-medium text-bg transition-colors duration-150 hover:bg-ink/90 active:scale-[0.98]";
const ICON_BTN =
  "inline-flex size-9 items-center justify-center rounded-xl border border-ink/15 text-mute transition-colors duration-150 hover:border-ink hover:text-ink active:scale-[0.97] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

// Page entrance — the two panels blur-focus in (same vocabulary as the services
// page's BlockReveal/StaggerGrid) so the timing matches the rest of the site.
const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: ENTRANCE_STAGGER, delayChildren: 0.05 },
  },
};

const item: Variants = {
  hidden: ENTRANCE_HIDDEN,
  show: {
    ...ENTRANCE_SHOW,
    transition: { duration: ENTRANCE_DURATION, ease: REVEAL_EASE },
  },
};

export function AccountView({
  userName,
  email,
  phone,
  telegram,
  telegramConnected,
  telegramConnectUrl,
  dev = false,
  appointments,
  standaloneBookings,
  nextAppointment,
}: AccountViewProps) {
  const isApp = useIsApp();
  const empty = appointments.length === 0 && standaloneBookings.length === 0;

  const nextEntry = nextAppointment
    ? appointments.find((a) => a.id === nextAppointment.id) ?? null
    : null;

  const feed = useMemo<FeedItem[]>(() => {
    const appts = appointments
      .filter((a) => a.id !== nextEntry?.id)
      .map((a) => ({ kind: "appt" as const, sortMs: a.sortMs, appt: a }));
    const books = standaloneBookings.map((b) => ({
      kind: "booking" as const,
      sortMs: b.sortMs,
      booking: b,
    }));
    return [...appts, ...books].sort((x, y) => y.sortMs - x.sortMs);
  }, [appointments, standaloneBookings, nextEntry]);

  const total = feed.length + (nextEntry ? 1 : 0);

  return (
    <MotionConfig reducedMotion="user">
      <AuthBackdrop />

      <Section className="relative z-10">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-8 lg:grid-cols-[22rem_1fr]"
        >
          {/* ── Rail: identity + contact + telegram + actions ── */}
          <motion.aside
            variants={item}
            className={`${SURFACE} flex h-fit flex-col gap-7 p-7 sm:p-10`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate font-display text-3xl font-medium tracking-tight text-ink">
                  {userName}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <EditProfileDrawer
                  name={userName}
                  email={email}
                  phone={phone}
                  telegram={telegram}
                  telegramConnected={telegramConnected}
                />
                <form action={signOutPublicAction}>
                  <button
                    type="submit"
                    aria-label={t.logout}
                    title={t.logout}
                    className={ICON_BTN}
                  >
                    <ExitIcon />
                  </button>
                </form>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-line pt-6">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-mute">
                {t.contactHeading}
              </p>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-mute">{t.emailLabel}</dt>
                  <dd className="min-w-0 truncate text-ink">{email}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-mute">{t.phoneLabel}</dt>
                  <dd className="truncate text-ink">
                    {phone ? (
                      <a
                        href={`tel:${ruPhoneHref(phone)}`}
                        className="transition-colors duration-150 hover:text-accent"
                      >
                        {formatRuPhone(phone)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-mute">
                    {t.telegramLabel}
                    {telegramConnected ? <DisconnectTelegram /> : null}
                  </dt>
                  <dd className="flex min-w-0 items-center gap-2 text-ink">
                    {telegramConnected ? (
                      <span className="truncate">
                        {telegram || t.tgConnectedShort}
                      </span>
                    ) : telegramConnectUrl ? (
                      <a
                        href={telegramConnectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-medium text-ink underline-offset-4 transition-colors duration-150 hover:text-accent hover:underline"
                      >
                        <TelegramIcon />
                        {t.tgConnect}
                      </a>
                    ) : (
                      <span className="truncate">{telegram || "—"}</span>
                    )}
                  </dd>
                </div>
              </dl>
              {dev ? (
                <div className="pt-1">
                  <DevTelegramToggle />
                </div>
              ) : null}
            </div>

            <div className="border-t border-ink/10 pt-6">
              <Link href="/book" className={`${PILL} w-full`}>
                <span aria-hidden className="size-[5px] rounded-full bg-accent" />
                {ru.nav.cta}
              </Link>
            </div>

            {/* App shell hides the site header, so surface its secondary pages
                here. Inert / hidden on the browser site. */}
            {isApp ? (
              <nav
                aria-label="Разделы"
                className="flex flex-col border-t border-ink/10 pt-4"
              >
                {APP_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex items-center justify-between rounded-lg px-1 py-2.5 text-sm text-mute no-underline transition-colors duration-150 hover:text-ink"
                  >
                    {l.label}
                    <ChevronRightIcon />
                  </Link>
                ))}
              </nav>
            ) : null}
          </motion.aside>

          {/* ── Feed ── */}
          <motion.div variants={item} className={`${SURFACE} p-7 sm:p-10`}>
            {empty ? (
              <>
                <FeedHeading label={t.activityHeading} count={total} />
                <p className="mt-8 text-sm text-mute">{t.empty}</p>
              </>
            ) : (
              <Feed
                feed={feed}
                nextEntry={nextEntry}
                nextCountdownLabel={nextAppointment?.countdownLabel}
                total={total}
              />
            )}
          </motion.div>
        </motion.div>
      </Section>
    </MotionConfig>
  );
}

function DisconnectTelegram() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        aria-label={t.tgDisconnect}
        title={t.tgDisconnect}
        className="-my-1 inline-flex shrink-0 items-center justify-center rounded-full p-1 text-mute transition-colors duration-150 hover:text-error disabled:opacity-50"
      >
        <UnlinkIcon />
      </button>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => {
          startTransition(async () => {
            await disconnectTelegram();
            setOpen(false);
          });
        }}
        title={t.tgDisconnectConfirm}
        confirmLabel={t.tgDisconnect}
        cancelLabel={t.cancelConfirmNo}
        pending={pending}
        tone="danger"
      />
    </>
  );
}

// TEMP dev control — fake-connects/disconnects Telegram to preview both states.
function DevTelegramToggle() {
  return (
    <form action={devToggleTelegram}>
      <button
        type="submit"
        className="rounded border border-dashed border-ink/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-mute transition-colors duration-150 hover:border-ink/60 hover:text-ink"
      >
        DEV: toggle Telegram
      </button>
    </form>
  );
}

function UnlinkIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Broken chain — two halves pulled apart with motion sparks (lucide "unlink"). */}
      <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <line x1="2" y1="8" x2="5" y2="8" />
      <line x1="16" y1="19" x2="16" y2="22" />
      <line x1="19" y1="16" x2="22" y2="16" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M10 11l3-3-3-3M13 8H6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-ink-line-strong"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M21.94 4.6 18.9 19.2c-.23 1.03-.85 1.28-1.72.8l-4.73-3.49-2.28 2.2c-.25.25-.46.46-.95.46l.34-4.82 8.77-7.93c.38-.34-.08-.53-.6-.19L6.62 13.2l-4.67-1.46c-1.02-.32-1.04-1.01.21-1.5L20.66 3.1c.85-.31 1.59.2 1.28 1.5z" />
    </svg>
  );
}
