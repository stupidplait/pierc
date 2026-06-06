"use client";

import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/shadcn/ui/card";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { Label } from "@/components/shadcn/ui/label";
import { FieldError } from "@/components/admin/content/fields";
import { SaveButton } from "@/components/admin/settings/SaveButton";
import { updateAbout, type ActionState } from "@/lib/admin/content-actions";
import { ru } from "@/lib/i18n/ru";

const REQUIRED = "Текст не может быть пустым";

/**
 * The "About" editor — a single shadcn Card holding one textarea behind the
 * shared {@link SaveButton} (same morph/pending states as settings). Client-first
 * validation (the body can't be empty) with an inline FieldError, a sonner toast
 * for the result, and a dirty guard so Save only enables once the text changes.
 * The textarea is controlled so its content survives React 19's `<form action>`
 * reset on a failed submit.
 */
export function AboutEditorForm({ initialBody }: { initialBody: string }) {
  const t = ru.admin.content.about;
  const uid = useId();
  const errorId = `${uid}-error`;

  const [body, setBody] = useState(initialBody);
  const [savedBody, setSavedBody] = useState(initialBody);
  const [error, setError] = useState<string | undefined>(undefined);
  const dirty = body !== savedBody;

  const validatedAction = async (
    prev: ActionState,
    formData: FormData,
  ): Promise<ActionState> => {
    if (!String(formData.get("body") ?? "").trim()) {
      setError(REQUIRED);
      toast.error(REQUIRED);
      document.getElementById(uid)?.focus();
      return { ok: false, error: REQUIRED };
    }
    setError(undefined);
    const res = await updateAbout(prev, formData);
    if (res?.ok) {
      setSavedBody(body);
      toast.success(res.message ?? ru.admin.common.saved);
    } else if (res) {
      setError(res.error);
      toast.error(res.error || ru.admin.common.saveError);
    }
    return res;
  };

  const [, action, pending] = useActionState<ActionState, FormData>(
    validatedAction,
    undefined,
  );

  return (
    <Card>
      <form action={action} noValidate>
        <CardHeader>
          <h2 className="font-display text-xl font-medium tracking-tight text-ink">
            {t.title}
          </h2>
          <CardDescription className="max-w-prose">{t.lead}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={uid}>{t.bodyLabel}</Label>
              <Textarea
                id={uid}
                name="body"
                value={body}
                onChange={(e) => {
                  setBody(e.currentTarget.value);
                  if (error) setError(undefined);
                }}
                rows={12}
                placeholder={t.bodyPlaceholder}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
            </div>
            <FieldError id={errorId} error={error} />
          </div>
          <div>
            <SaveButton
              pending={pending}
              disabled={pending || !dirty}
              label={t.save}
              pendingLabel={ru.admin.settings.saving}
            />
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
