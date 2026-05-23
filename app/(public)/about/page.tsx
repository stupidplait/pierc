import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: `${ru.pages.about.title} — ${ru.studio.name}`,
};

interface AboutContent {
  body?: string;
}

export default async function AboutPage() {
  const [row, settings] = await Promise.all([
    prisma.siteContent.findUnique({ where: { key: "about" } }),
    prisma.settings.findUnique({ where: { id: "default" } }),
  ]);

  const body = (row?.content as AboutContent | null)?.body ?? "";
  const paragraphs: string[] = [];
  for (const raw of body.split(/\n{2,}/)) {
    const t = raw.trim();
    if (t) paragraphs.push(t);
  }

  const email = settings?.contactEmail ?? null;
  const phone = settings?.contactPhone ?? null;
  const address = settings?.contactAddress ?? null;
  const hours = settings?.workingHoursHint ?? null;
  const t = ru.pages.about;

  return (
    <Section>
      <PageHeader title={t.title} lead={t.lead} />

      {paragraphs.length === 0 ? (
        <p className="text-mute">{t.stub}</p>
      ) : (
        <div className="prose prose-lg max-w-2xl text-ink">
          {paragraphs.map((p) => (
            <p key={p.slice(0, 32)} className="mb-4 text-ink last:mb-0">
              {p}
            </p>
          ))}
        </div>
      )}

      <section id="contact" className="mt-20 scroll-mt-24">
        <header className="mb-6">
          <h2 className="font-display text-3xl font-medium text-ink sm:text-4xl">
            {t.contactsHeading}
          </h2>
          <p className="mt-2 text-mute">{t.contactsLead}</p>
        </header>

        <Card className="grid gap-6 sm:grid-cols-2">
          <ContactItem label={t.email}>
            {email ? (
              <a
                href={`mailto:${email}`}
                className="text-ink transition-colors hover:text-primary"
              >
                {email}
              </a>
            ) : (
              <span className="text-mute">–</span>
            )}
          </ContactItem>
          <ContactItem label={t.phone}>
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s|\(|\)|-/g, "")}`}
                className="text-ink transition-colors hover:text-primary"
              >
                {phone}
              </a>
            ) : (
              <span className="text-mute">–</span>
            )}
          </ContactItem>
          <ContactItem label={t.address}>
            <span className="text-ink">{address ?? "–"}</span>
          </ContactItem>
          <ContactItem label={t.hours}>
            <span className="text-ink">{hours ?? "–"}</span>
          </ContactItem>
        </Card>
      </section>
    </Section>
  );
}

function ContactItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
        {label}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}
