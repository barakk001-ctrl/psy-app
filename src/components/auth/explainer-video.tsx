"use client";

import { useState } from "react";
import { PlayCircle, X } from "lucide-react";

/** "How it works" — opens the narrated explainer video in a lightbox. */
export function ExplainerVideo({
  label = "איך זה עובד? צפו בסרטון (דקה וחצי)",
  className = "mx-auto flex items-center gap-2 text-sm text-sage-600 hover:text-sage-700 font-medium",
}: {
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        <PlayCircle className="w-5 h-5" />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="סרטון הסבר"
        >
          <div
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-3xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגירה"
              className="absolute -top-10 end-0 p-2 text-cream-50/90 hover:text-cream-50"
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src="/explainer.mp4"
              controls
              autoPlay
              playsInline
              className="w-full rounded-2xl shadow-lift bg-black"
            />
          </div>
        </div>
      )}
    </>
  );
}
