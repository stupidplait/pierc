"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/shadcn/ui/button";
import { ServiceItem } from "./ServiceItem";
import { ru } from "@/lib/i18n/ru";

/** Reveals a blank service editor on demand instead of a permanently-open form. */
export function AddService() {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return <ServiceItem isNew defaultOpen onCancel={() => setAdding(false)} />;
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => setAdding(true)}
      className="w-fit gap-2"
    >
      <Plus className="size-4" />
      {ru.admin.content.services.addHeading}
    </Button>
  );
}
