"use client";

import { motion } from "framer-motion";
import { ru } from "@/lib/i18n/ru";
import { item } from "./shared";

const t = ru.admin.dashboard;

// Dashboard hero — display title + personalised lead, in the same vocabulary
// as the public PageHeader (display font, muted lead). Rendered as a motion
// item so it joins the stagger entrance.
export function DashHeader({ adminName }: { adminName: string }) {
  return (
    <motion.header variants={item} className="mb-10 pt-2 sm:mb-12 sm:pt-4">
      <h1 className="font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
        {t.title}
      </h1>
      <p className="mt-3 text-base text-mute">
        {adminName ? `${t.welcome}, ${adminName}. ${t.lead}` : t.lead}
      </p>
    </motion.header>
  );
}
