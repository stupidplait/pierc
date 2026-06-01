// Settings loading skeleton. The protected group's loading.tsx is dashboard-
// shaped (a Status Board), so without this per-segment override the settings
// route would flash that placeholder on navigation. This mirrors
// app/admin/(protected)/settings/page.tsx + components/admin/settings/SettingsWorkspace:
// hero header → two-column shell (sticky numbered TOC rail on lg+, editor
// column on the right) → three form-section cards + the notifications card,
// floating a sticky save bar between the form and the notifications card.
// Convention (matches the dashboard/catalog skeletons): bare blocks on the page
// use bg-card; blocks sitting inside a card surface use bg-ink/10.

import { CARD } from "@/components/admin/form/styles";

/** Labelled control — label bar over an input block. Mirrors SettingsField. */
function Field({ full }: { full?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <div className="h-3.5 w-24 animate-pulse rounded bg-ink/10" />
      <div className="h-11 animate-pulse rounded-xl bg-ink/10" />
    </div>
  );
}

/** One editor card — header (title + lead) over a two-up field grid. */
function SectionCard({ fields }: { fields: { full?: boolean }[] }) {
  return (
    <div className={CARD}>
      {/* CardHeader — title + description. */}
      <div className="flex flex-col gap-2 p-6">
        <div className="h-6 w-44 animate-pulse rounded-lg bg-ink/10" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ink/10" />
      </div>
      {/* CardContent — sm:grid-cols-2 field grid. */}
      <div className="grid gap-5 p-6 pt-0 sm:grid-cols-2">
        {fields.map((f, i) => (
          <Field key={i} full={f.full} />
        ))}
      </div>
    </div>
  );
}

// Section field layouts, mirroring SETTINGS_SECTIONS: contacts (email, phone,
// address·full, hours), social (instagram, telegram), integrations (chatId·full).
const SECTIONS: { full?: boolean }[][] = [
  [{}, {}, { full: true }, {}],
  [{}, {}],
  [{ full: true }],
];

// TOC rail label widths so the numbered index reads like real section names
// (Контакты · Соцсети · Интеграции · Уведомления) rather than identical bars.
const RAIL_WIDTHS = ["w-20", "w-16", "w-24", "w-28"];

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl">
      {/* Hero header — title + lead. */}
      <header className="mb-10 pt-2 sm:mb-12 sm:pt-4">
        <div className="h-11 w-56 animate-pulse rounded-2xl bg-card sm:h-14" />
        <div className="mt-4 h-5 w-80 max-w-full animate-pulse rounded-lg bg-card" />
      </header>

      <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-12">
        {/* ── Sticky numbered TOC rail (lg+) ──────────────────────────── */}
        <div className="hidden lg:block">
          <div className="sticky top-8">
            {/* Eyebrow — hairline rule + small-caps label. */}
            <div className="mb-5 flex items-center gap-3">
              <span aria-hidden className="h-px w-8 bg-ink-line-strong" />
              <div className="h-3 w-16 animate-pulse rounded bg-card" />
            </div>
            {/* Numbered entries — mono index + label. */}
            <ol className="space-y-3">
              {RAIL_WIDTHS.map((w, i) => (
                <li key={i} className="flex items-baseline gap-3">
                  <div className="h-3 w-4 animate-pulse rounded bg-card" />
                  <div className={`h-3.5 ${w} animate-pulse rounded bg-card`} />
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* ── Editor column ───────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6">
          {SECTIONS.map((fields, i) => (
            <SectionCard key={i} fields={fields} />
          ))}

          {/* Sticky save bar — ink save pill + a hint on the right. */}
          <div className="sticky bottom-4 z-20 mt-1">
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card/85 px-5 py-3.5 shadow-[0_1px_2px_rgba(8,8,8,0.5),0_12px_30px_-12px_rgba(8,8,8,0.7)] backdrop-blur-xl">
              <div className="h-11 w-24 animate-pulse rounded-xl bg-ink/10" />
              <div className="ml-auto hidden h-3.5 w-40 animate-pulse rounded bg-ink/10 sm:block" />
            </div>
          </div>

          {/* Notifications self-test — header (title + lead) over an action. */}
          <div className={CARD}>
            <div className="flex flex-col gap-2 p-6">
              <div className="h-6 w-48 animate-pulse rounded-lg bg-ink/10" />
              <div className="h-4 w-64 max-w-full animate-pulse rounded bg-ink/10" />
            </div>
            <div className="p-6 pt-0">
              <div className="h-11 w-44 animate-pulse rounded-xl bg-ink/10" />
            </div>
          </div>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
