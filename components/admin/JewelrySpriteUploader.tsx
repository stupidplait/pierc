"use client";

import { useCallback, useState } from "react";
import { JewelrySpriteUploadForm } from "@/components/admin/JewelrySpriteUploadForm";
import { SpriteAutoRemover } from "@/components/admin/SpriteAutoRemover";
import { ru } from "@/lib/i18n/ru";

interface JewelrySpriteUploaderProps {
  jewelryId: string;
  blobConfigured: boolean;
}

type Tab = "auto" | "manual";

/**
 * Client-side container that switches between the auto bg-removal flow
 * (default) and the manual transparent-PNG upload flow. The segmented
 * control state is in-memory only — refresh restores the default.
 */
export function JewelrySpriteUploader({
  jewelryId,
  blobConfigured,
}: JewelrySpriteUploaderProps) {
  const t = ru.admin.jewelry.sprite;
  const [tab, setTab] = useState<Tab>("auto");

  const switchToManual = useCallback(() => setTab("manual"), []);

  return (
    <div className="flex flex-col gap-5">
      {/* Segmented control */}
      <div
        role="tablist"
        aria-label={t.heading}
        className="inline-flex self-start rounded-full border border-line bg-page p-1 text-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "auto"}
          onClick={() => setTab("auto")}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
            tab === "auto"
              ? "bg-primary text-on-primary"
              : "text-mute hover:text-ink"
          }`}
        >
          {t.tabAuto}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "manual"}
          onClick={() => setTab("manual")}
          className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
            tab === "manual"
              ? "bg-primary text-on-primary"
              : "text-mute hover:text-ink"
          }`}
        >
          {t.tabManual}
        </button>
      </div>

      {tab === "auto" ? (
        <SpriteAutoRemover
          jewelryId={jewelryId}
          blobConfigured={blobConfigured}
          onSwitchToManual={switchToManual}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="max-w-prose text-sm text-mute">{t.manualLead}</p>
          <JewelrySpriteUploadForm
            jewelryId={jewelryId}
            blobConfigured={blobConfigured}
          />
        </div>
      )}
    </div>
  );
}
