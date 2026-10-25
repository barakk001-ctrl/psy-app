import { LegalBackButton, BackToTopButton } from "./legal-page-controls";

export type LegalSection = { title: string; items: string[] };

/**
 * The shared shell of the public legal pages (/agreement, /terms, /privacy):
 * one ordinary page that scrolls as a whole (no inner scroll container), a
 * small sticky bar with the title and "חזרה", the draft note, the sections,
 * and a "לראש העמוד" button once the reader has scrolled down.
 *
 * `legal-page` on the root is what globals.css uses to keep the document from
 * becoming a nested scroller on iOS (see the comment there).
 */
export function LegalPage({
  title,
  barTitle,
  subtitle,
  draftNote,
  sections,
  version,
  footer,
}: {
  title: string;
  /** shorter title for the sticky bar */
  barTitle: string;
  subtitle: string;
  draftNote: string;
  sections: LegalSection[];
  version: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="legal-page min-h-screen bg-cream-50">
      <div className="sticky top-0 z-20 border-b border-cream-200 bg-cream-50/95 backdrop-blur pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <span className="font-display text-base text-ink truncate">{barTitle}</span>
          <LegalBackButton />
        </div>
      </div>

      <div id="top" className="max-w-2xl mx-auto px-5 pt-8 pb-24">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-ink">{title}</h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">{subtitle}</p>
          <p className="mt-3 rounded-lg border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-xs text-terracotta-600 leading-relaxed">
            {draftNote}
          </p>
        </header>

        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="font-display text-lg text-ink mb-2">{s.title}</h2>
              <ul className="space-y-1.5 text-sm text-ink-soft leading-relaxed list-disc ps-5">
                {s.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {footer}
        <p className="text-xs text-ink-subtle mt-4">גרסה: {version}</p>
      </div>

      <BackToTopButton />
    </div>
  );
}
