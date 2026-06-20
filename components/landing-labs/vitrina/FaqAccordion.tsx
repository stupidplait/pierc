"use client";

import { useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import styles from "./vitrina.module.css";
import { FAQ } from "./content";

/**
 * FaqAccordion — a single-open accordion. State is only ever set from the click
 * handler (an event, never inside an effect), so the strict react-hooks lint is
 * satisfied. The panel height animates via framer's auto height; under
 * prefers-reduced-motion it snaps open with no transition.
 */
export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();

  return (
    <div className={styles.faqWrap}>
      {FAQ.map((item, i) => {
        const isOpen = open === i;
        const panelId = `vt-faq-panel-${i}`;
        const btnId = `vt-faq-btn-${i}`;
        return (
          <div key={item.q} className={styles.faqItem}>
            <button
              id={btnId}
              type="button"
              className={styles.faqBtn}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span>{item.q}</span>
              <Plus
                className={`${styles.faqIcon} ${isOpen ? styles.faqIconOpen : ""}`}
                size={24}
                aria-hidden="true"
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <m.div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className={styles.faqPanel}
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className={styles.faqAnswer}>{item.a}</p>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
