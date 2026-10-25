"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ArrowUp } from "lucide-react";

/**
 * "חזרה": the sign-up form opens these pages in a new tab (so what was typed
 * there is kept) — closing that tab returns to it. Opened from a link in the
 * same tab, it goes back; opened directly, it goes to the login page.
 */
export function LegalBackButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.close();
        // Still here (the browser refused to close the tab): go to sign-in
        window.setTimeout(() => window.location.assign("/login"), 250);
      }}
      className="inline-flex items-center gap-1 h-9 px-3 -me-2 rounded-lg text-sm font-medium text-sage-700 hover:bg-sage-50"
    >
      <ArrowRight className="w-4 h-4" />
      חזרה
    </button>
  );
}

/** Appears after scrolling down; brings the reader back to the title. */
export function BackToTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const update = () => setShow(window.scrollY > 400);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const from = window.scrollY;
        window.scrollTo({ top: 0, behavior: "smooth" });
        // Smooth scrolling can be off or stalled (reduced motion, background
        // tab): if nothing moved, jump.
        window.setTimeout(() => {
          if (window.scrollY === from) window.scrollTo(0, 0);
        }, 600);
      }}
      className="fixed end-4 z-20 inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white/95 px-4 h-11 text-sm font-medium text-ink shadow-soft"
      style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <ArrowUp className="w-4 h-4" />
      לראש העמוד
    </button>
  );
}
