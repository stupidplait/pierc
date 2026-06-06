import { CARD } from "@/components/admin/form/styles";

function Field({ full }: { full?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <div className="h-3.5 w-24 animate-pulse rounded bg-ink/10" />
      <div className="h-11 animate-pulse rounded-xl bg-ink/10" />
    </div>
  );
}

function SectionCard({ fields }: { fields: { key: string; full?: boolean }[] }) {
  return (
    <div className={CARD}>
      <div className="flex flex-col gap-1.5 p-6">
        <div className="h-6 w-32 animate-pulse rounded-lg bg-ink/10" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ink/10" />
      </div>
      <div className="grid gap-5 p-6 pt-0 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.key} full={f.full} />
        ))}
      </div>
    </div>
  );
}

const SECTIONS: { key: string; fields: { key: string; full?: boolean }[] }[] = [
  {
    key: "contacts",
    fields: [
      { key: "email" },
      { key: "phone" },
      { key: "address" },
      { key: "hours" },
    ],
  },
  { key: "social", fields: [{ key: "instagram" }, { key: "telegram" }] },
  { key: "integrations", fields: [{ key: "chatId", full: true }] },
];

export default function Loading() {
  return (
    <div aria-hidden="true" className="mx-auto w-full max-w-6xl">
      <header className="mb-8 pt-2 sm:mb-10 sm:pt-4">
        <div className="h-11 w-56 animate-pulse rounded-2xl bg-card sm:h-14" />
        <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded-lg bg-card" />
      </header>

      <div className="flex w-full flex-col gap-6">
        {SECTIONS.map((section) => (
          <SectionCard key={section.key} fields={section.fields} />
        ))}

        <div className="sticky bottom-4 z-20 mt-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-card px-5 py-3.5 shadow-elev">
            <div className="h-11 w-36 animate-pulse rounded-xl bg-ink/10" />
            <div className="ml-auto hidden h-3.5 w-40 animate-pulse rounded bg-ink/10 sm:block" />
          </div>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Загрузка…
      </p>
    </div>
  );
}
