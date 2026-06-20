import { Reveal } from "@/components/motion/Reveal";
import { BlurReveal } from "@/components/motion/BlurReveal";
import { WordReveal } from "@/components/motion/WordReveal";

// Above this length the opening paragraph reads as body prose, not a display
// statement — so a long admin-written lede with no blank line doesn't blow up
// into an oversized blockquote with an empty supporting grid beneath it.
const PULL_QUOTE_MAX = 280;

// Stable, index-free key for the static story paragraphs (split from one text
// blob, never reordered) — a small djb2 hash keeps React keys content-derived
// instead of leaning on the array index.
function paragraphKey(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

/**
 * Studio story — the opening paragraph as a display pull-quote (with an accent
 * rule) when short enough, then the supporting paragraphs as a two-column grid.
 * Falls back to a stub when there's no content yet. Server component.
 */
export function AboutStory({
  paragraphs,
  stub,
  inView,
}: {
  paragraphs: string[];
  stub: string;
  inView: number;
}) {
  if (paragraphs.length === 0) {
    return <p className="text-mute">{stub}</p>;
  }

  // Only lead with a pull-quote when the first paragraph is short enough to read
  // as a display statement; otherwise everything renders as body prose.
  const leadIsQuote = paragraphs[0].length <= PULL_QUOTE_MAX;
  const quote = leadIsQuote ? paragraphs[0] : null;
  const body = leadIsQuote ? paragraphs.slice(1) : paragraphs;

  return (
    <div>
      {quote ? (
        <div className="relative">
          {/* The accent rule beside the pull-quote — its own element so it can
              play the house blur entrance as the quote streams in. */}
          <BlurReveal
            as="span"
            trigger="in-view"
            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary"
          />
          <WordReveal
            as="blockquote"
            text={quote}
            stagger={0.03}
            className="pl-6 font-display text-2xl font-medium leading-snug text-ink text-balance sm:text-3xl"
          />
        </div>
      ) : null}
      {body.length > 0 ? (
        <Reveal
          amount={inView}
          delay={0.1}
          className={`grid gap-5 text-mute sm:grid-cols-2 sm:gap-8 ${
            quote ? "mt-8" : ""
          }`}
        >
          {body.map((p) => (
            <p key={paragraphKey(p)}>{p}</p>
          ))}
        </Reveal>
      ) : null}
    </div>
  );
}
