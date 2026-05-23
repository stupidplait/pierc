import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ru } from "@/lib/i18n/ru";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/ui/PageHeader";
import { StepIndicator } from "@/components/booking/StepIndicator";
import { PurposeStep } from "@/components/booking/PurposeStep";
import { JewelryStep } from "@/components/booking/JewelryStep";
import { SlotStep } from "@/components/booking/SlotStep";
import { ContactStep } from "@/components/booking/ContactStep";
import { parseBookingState } from "@/lib/booking/url-state";
import { getCachedPublicUser } from "@/lib/public/queries";

export const metadata: Metadata = {
  title: `${ru.pages.book.title} — ${ru.studio.name}`,
};

const RU_LONG = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

interface BookPageProps {
  searchParams: Promise<{
    step?: string;
    purpose?: string;
    items?: string;
    slot?: string;
  }>;
}

export default async function BookPage({ searchParams }: BookPageProps) {
  const sp = await searchParams;
  const state = parseBookingState(sp);

  return (
    <Section>
      <PageHeader title={ru.pages.book.title} lead={ru.pages.book.lead} />
      <div className="mx-auto max-w-3xl">
        <StepIndicator step={state.step} purpose={state.purpose} />

        {state.step === "purpose" ? (
          <PurposeStep itemIds={state.itemIds} />
        ) : null}

        {state.step === "jewelry" && state.purpose ? (
          <JewelryStep
            purpose={state.purpose}
            selectedIds={state.itemIds}
          />
        ) : null}

        {state.step === "slot" && state.purpose ? (
          <SlotStep
            purpose={state.purpose}
            itemIds={state.itemIds}
            selectedSlotId={state.slotId}
          />
        ) : null}

        {state.step === "contact" && state.purpose ? (
          <AwaitContactStep
            purpose={state.purpose}
            itemIds={state.itemIds}
            slotId={state.slotId}
          />
        ) : null}
      </div>
    </Section>
  );
}

// Small wrapper that fetches the summary the contact step needs (server-side
// jewelry + slot lookup) without making ContactStep itself a server component.
async function AwaitContactStep({
  purpose,
  itemIds,
  slotId,
}: {
  purpose: NonNullable<ReturnType<typeof parseBookingState>["purpose"]>;
  itemIds: string[];
  slotId: string | null;
}) {
  const [items, slot, user] = await Promise.all([
    itemIds.length > 0
      ? prisma.jewelry.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, name: true, price: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string; price: { toString(): string } }>),
    slotId
      ? prisma.availabilitySlot.findUnique({
          where: { id: slotId },
          select: { id: true, startsAt: true, endsAt: true },
        })
      : Promise.resolve(null),
    getCachedPublicUser(),
  ]);

  const summaryItems = itemIds
    .map((id) => items.find((j) => j.id === id))
    .filter((j): j is NonNullable<typeof j> => Boolean(j))
    .map((j) => ({ id: j.id, name: j.name, price: j.price.toString() }));

  const summarySlot = slot
    ? {
        id: slot.id,
        label: `${RU_LONG.format(slot.startsAt)} — ${slot.endsAt
          .toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`,
      }
    : null;

  return (
    <ContactStep
      purpose={purpose}
      itemIds={itemIds}
      slotId={slotId}
      summary={{ items: summaryItems, slot: summarySlot }}
      user={user ? { name: user.name, email: user.email } : null}
    />
  );
}
