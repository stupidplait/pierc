"use client";

import { useActionState } from "react";
import {
  TextField,
  TextAreaField,
  NumberField,
  CheckboxField,
  FormStatus,
  PrimarySubmit,
} from "@/components/admin/FormFields";
import {
  upsertJewelry,
  type ActionState,
} from "@/lib/admin/jewelry-actions";
import {
  ru,
  jewelryStatusLabels,
  bodyPlaceLabels,
  bodyPlaceOrder,
} from "@/lib/i18n/ru";
import type { BodyPlace } from "@/lib/catalog/types";

interface CategoryOption {
  id: string;
  name: string;
}

interface AnchorOption {
  id: string;
  slug: string;
  name: string;
  place: BodyPlace;
}

interface JewelryLike {
  id?: string;
  name?: string;
  description?: string | null;
  categoryId?: string;
  material?: string;
  gauge?: number | null;
  size?: number | null;
  color?: string | null;
  stones?: string | null;
  price?: number | string | null;
  inStock?: number;
  glbUrl?: string | null;
  glbThumbUrl?: string | null;
  status?: keyof typeof jewelryStatusLabels;
  featured?: boolean;
  anchorIds?: string[];
}

interface JewelryFormProps {
  initial?: JewelryLike;
  categories: CategoryOption[];
  anchors: AnchorOption[];
  isNew?: boolean;
}

export function JewelryForm({
  initial,
  categories,
  anchors,
  isNew = false,
}: JewelryFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    upsertJewelry,
    undefined,
  );
  const t = ru.admin.jewelry;
  const f = t.fields;
  const ph = t.placeholders;
  const selectedAnchors = new Set(initial?.anchorIds ?? []);

  // Group anchors by place for clearer scanning.
  const grouped = {} as Record<BodyPlace, AnchorOption[]>;
  for (const place of bodyPlaceOrder) grouped[place] = [];
  for (const a of anchors) grouped[a.place].push(a);

  return (
    <form action={action} className="flex flex-col gap-8">
      {initial?.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      {/* в”Ђв”Ђ Attributes в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {t.sections.attributes}
        </legend>

        <TextField
          name="name"
          label={f.name}
          required
          defaultValue={initial?.name}
        />
        <TextAreaField
          name="description"
          label={f.description}
          defaultValue={initial?.description}
          rows={3}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">{f.category}</span>
            <select
              name="categoryId"
              required
              defaultValue={initial?.categoryId ?? ""}
              className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <option value="">вЂ“</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <TextField
            name="material"
            label={f.material}
            required
            defaultValue={initial?.material}
            placeholder={ph.material}
          />

          <NumberField
            name="gauge"
            label={f.gauge}
            defaultValue={initial?.gauge ?? ""}
            step="0.1"
            min={0}
          />
          <NumberField
            name="size"
            label={f.size}
            defaultValue={initial?.size ?? ""}
            step="0.1"
            min={0}
          />

          <TextField
            name="color"
            label={f.color}
            defaultValue={initial?.color}
            placeholder={ph.color}
          />
          <TextField
            name="stones"
            label={f.stones}
            defaultValue={initial?.stones}
            placeholder={ph.stones}
          />

          <NumberField
            name="price"
            label={f.price}
            defaultValue={initial?.price?.toString() ?? ""}
            step="0.01"
            min={0}
          />
          <NumberField
            name="inStock"
            label={f.inStock}
            defaultValue={initial?.inStock ?? 0}
            min={0}
          />
        </div>
      </fieldset>

      {/* в”Ђв”Ђ Anchors в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {t.sections.anchors}
        </legend>
        <div className="grid gap-4 rounded-2xl border border-line bg-card/40 p-4 sm:grid-cols-3">
          {bodyPlaceOrder.map((place) =>
            grouped[place].length > 0 ? (
              <div key={place} className="flex flex-col gap-2">
                <h4 className="text-xs uppercase tracking-[0.15em] text-mute">
                  {bodyPlaceLabels[place]}
                </h4>
                <ul className="flex flex-col gap-1">
                  {grouped[place].map((a) => (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm text-ink hover:bg-page">
                        <input
                          type="checkbox"
                          name="anchorIds"
                          value={a.id}
                          defaultChecked={selectedAnchors.has(a.id)}
                          className="size-4 rounded border-line text-primary focus:ring-primary"
                        />
                        <span>{a.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      </fieldset>

      {/* в”Ђв”Ђ 3D model + status в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ */}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-medium uppercase tracking-[0.2em] text-mute">
          {t.sections.modelAndStatus}
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="glbUrl"
            label={f.glbUrl}
            defaultValue={initial?.glbUrl}
            placeholder="https://вЂ¦/model.glb"
          />
          <TextField
            name="glbThumbUrl"
            label={f.glbThumbUrl}
            defaultValue={initial?.glbThumbUrl}
          />
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink">{f.status}</span>
            <select
              name="status"
              defaultValue={initial?.status ?? "DRAFT"}
              className="h-11 rounded-xl border border-line bg-page px-4 text-ink outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {Object.entries(jewelryStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <CheckboxField
            name="featured"
            label={f.featured}
            defaultChecked={initial?.featured ?? false}
          />
        </div>
      </fieldset>

      <FormStatus state={state} />
      <div>
        <PrimarySubmit pending={pending}>
          {pending ? "вЂ¦" : isNew ? t.create : t.save}
        </PrimarySubmit>
      </div>
    </form>
  );
}
