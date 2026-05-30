"use client";

import { useActionState, useState } from "react";
import { motion, MotionConfig } from "framer-motion";
import {
  upsertReview,
  type ReviewActionState,
} from "@/lib/admin/review-actions";
import { ru } from "@/lib/i18n/ru";
import { LABEL } from "@/components/admin/form/styles";
import { Card } from "@/components/shadcn/ui/card";
import { Button } from "@/components/shadcn/ui/button";
import { Input } from "@/components/shadcn/ui/input";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { Switch } from "@/components/shadcn/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { container, item } from "@/components/admin/reviews/ui";

interface JewelryOption {
  id: string;
  name: string;
  categoryName: string;
}

interface ReviewLike {
  id?: string;
  rating?: number;
  text?: string;
  authorName?: string;
  appointmentId?: string | null;
  status?: "PENDING" | "PUBLISHED" | "REJECTED";
  featured?: boolean;
  moderatorNotes?: string | null;
  jewelryIds?: string[];
}

interface ReviewFormProps {
  initial?: ReviewLike;
  jewelry: JewelryOption[];
  isNew?: boolean;
}

const STATUSES: Array<"PENDING" | "PUBLISHED" | "REJECTED"> = [
  "PENDING",
  "PUBLISHED",
  "REJECTED",
];

const t = ru.admin.reviews;
const f = t.fields;

export function ReviewForm({ initial, jewelry, isNew = false }: ReviewFormProps) {
  const [state, action, pending] = useActionState<ReviewActionState, FormData>(
    upsertReview,
    undefined,
  );

  const [rating, setRating] = useState<number>(initial?.rating ?? 5);
  const [selectedJewelry, setSelectedJewelry] = useState<Set<string>>(
    () => new Set(initial?.jewelryIds ?? []),
  );

  const toggleJewelry = (id: string, checked: boolean) => {
    setSelectedJewelry((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <MotionConfig reducedMotion="user">
      <form action={action}>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col gap-6"
        >
          {initial?.id ? (
            <input type="hidden" name="id" value={initial.id} />
          ) : null}

          {/* ── Content ──────────────────────────────────────────── */}
          <motion.div variants={item}>
            <Card className="p-7 sm:p-9">
              <CardHead heading={t.sections.attributes} />
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <span className={LABEL}>{f.rating}</span>
                  <RatingPicker value={rating} onChange={setRating} />
                  <input type="hidden" name="rating" value={rating} />
                </div>

                <Field label={f.text}>
                  <Textarea
                    name="text"
                    rows={5}
                    required
                    defaultValue={initial?.text ?? ""}
                    placeholder={f.textPlaceholder}
                  />
                </Field>

                <Field label={f.authorName}>
                  <Input
                    name="authorName"
                    required
                    defaultValue={initial?.authorName ?? ""}
                    placeholder={f.authorNamePlaceholder}
                    autoComplete="off"
                  />
                </Field>

                {!isNew && initial?.appointmentId ? (
                  <div className="rounded-xl border border-line bg-ink/3 p-3.5">
                    <span className={LABEL}>{f.appointmentId}</span>
                    <a
                      href={`/admin/appointments/${initial.appointmentId}`}
                      className="mt-1 block truncate text-sm text-accent underline-offset-4 hover:underline"
                    >
                      {initial.appointmentId}
                    </a>
                    <input
                      type="hidden"
                      name="appointmentId"
                      value={initial.appointmentId}
                    />
                  </div>
                ) : null}
              </div>
            </Card>
          </motion.div>

          {/* ── Jewelry tags ─────────────────────────────────────── */}
          <motion.div variants={item}>
            <Card className="p-7 sm:p-9">
              <CardHead heading={t.sections.jewelry} lead={f.jewelryHint} />
              {jewelry.length === 0 ? (
                <p className="text-sm text-mute">—</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {jewelry.map((j) => {
                    const checked = selectedJewelry.has(j.id);
                    return (
                      <label
                        key={j.id}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm transition-colors ${
                          checked
                            ? "border-accent/50 bg-accent/5"
                            : "border-ink/12 bg-ink/3 hover:border-ink/25"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="jewelryIds"
                          value={j.id}
                          checked={checked}
                          onChange={(e) => toggleJewelry(j.id, e.target.checked)}
                          className="mt-0.5 size-4 rounded border-ink/25 bg-ink/3 text-accent focus:ring-accent/30"
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-ink">{j.name}</span>
                          <span className="ml-1 text-mute">· {j.categoryName}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </Card>
          </motion.div>

          {/* ── Moderation ───────────────────────────────────────── */}
          <motion.div variants={item}>
            <Card className="p-7 sm:p-9">
              <CardHead heading={t.sections.moderation} />
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <span className={LABEL}>{f.status}</span>
                  <Select name="status" defaultValue={initial?.status ?? "PENDING"}>
                    <SelectTrigger aria-label={f.status} className="sm:max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {ru.admin.statusLabels.review[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <label
                  htmlFor="review-featured"
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink/12 bg-ink/3 px-3.5 py-3"
                >
                  <span className="text-sm text-ink">{f.featured}</span>
                  <Switch
                    id="review-featured"
                    name="featured"
                    defaultChecked={initial?.featured ?? false}
                  />
                </label>

                <Field label={f.moderatorNotes}>
                  <Textarea
                    name="moderatorNotes"
                    rows={3}
                    defaultValue={initial?.moderatorNotes ?? ""}
                    placeholder={f.moderatorNotesPlaceholder}
                  />
                </Field>
              </div>
            </Card>
          </motion.div>

          {/* ── Save ─────────────────────────────────────────────── */}
          <motion.div variants={item} className="flex flex-wrap items-center gap-4 pt-1">
            <Button type="submit" disabled={pending} className="px-6">
              {pending ? "…" : isNew ? t.actions.create : t.actions.save}
            </Button>
            {state ? <InlineStatus state={state} /> : null}
          </motion.div>
        </motion.div>
      </form>
    </MotionConfig>
  );
}

function CardHead({ heading, lead }: { heading: string; lead?: string }) {
  return (
    <div className="mb-7">
      <h2 className="font-display text-xl font-medium tracking-tight text-ink">
        {heading}
      </h2>
      {lead ? <p className="mt-1 max-w-prose text-sm text-mute">{lead}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

/** Click-to-rate 5-star control; hover previews, click commits. */
function RatingPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= shown;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} / 5`}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => onChange(n)}
              className="rounded-md p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className={filled ? "text-accent" : "text-ink/20"}
              >
                <path
                  d="M8 1.6l1.78 3.93 4.3.47-3.2 2.9.87 4.23L8 11.5l-3.75 2.03.87-4.23-3.2-2.9 4.3-.47L8 1.6Z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          );
        })}
      </div>
      <span className="ml-1 text-sm tabular-nums text-mute">{value}/5</span>
    </div>
  );
}

function InlineStatus({ state }: { state: NonNullable<ReviewActionState> }) {
  if (state.ok) {
    return (
      <span
        role="status"
        aria-live="polite"
        className="text-sm font-medium text-success"
      >
        {state.message ?? ru.admin.common.saved}
      </span>
    );
  }
  return (
    <span role="alert" aria-live="assertive" className="text-sm text-error">
      {state.error}
    </span>
  );
}
