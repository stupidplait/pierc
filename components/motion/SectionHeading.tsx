import { BlurReveal } from "@/components/motion/BlurReveal";

/**
 * Shared section-heading band for the "Instrument Dossier" pages (/about, /faq):
 * a short rule tick over a muted uppercase eyebrow, then the display-font title
 * and an optional lead. Each part blur-focuses in (the house entrance), cascaded
 * top-to-bottom so the whole band reads as one motion.
 *
 * Pass `titleId` to wire a section's `aria-labelledby` to the title.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  titleId,
  className = "mb-8 max-w-2xl",
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  titleId?: string;
  className?: string;
}) {
  return (
    <header className={className}>
      {eyebrow ? (
        <BlurReveal
          as="div"
          index={0}
          amount={0.6}
          className="mb-3 flex items-center gap-3"
        >
          <span aria-hidden className="h-px w-8 bg-ink-line-strong" />
          <p className="text-xs uppercase tracking-[0.3em] text-mute">
            {eyebrow}
          </p>
        </BlurReveal>
      ) : null}
      <BlurReveal as="div" index={1} amount={0.6}>
        <h2
          id={titleId}
          className="font-display text-3xl font-medium text-ink sm:text-4xl"
        >
          {title}
        </h2>
      </BlurReveal>
      {lead ? (
        <BlurReveal as="div" index={2} amount={0.6}>
          <p className="mt-2 text-mute">{lead}</p>
        </BlurReveal>
      ) : null}
    </header>
  );
}
