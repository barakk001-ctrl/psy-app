import {
  AGREEMENT_DRAFT_NOTE,
  AGREEMENT_SECTIONS,
  AGREEMENT_SUBTITLE,
  AGREEMENT_TITLE,
  AGREEMENT_VERSION,
} from "@/lib/agreement";

// Public page — linked from the registration checkbox, so it must be
// reachable without a session (listed in auth.config PUBLIC_PATHS).
export const metadata = { title: `${AGREEMENT_TITLE} — מרפאה` };

export default function AgreementPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-ink">{AGREEMENT_TITLE}</h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">{AGREEMENT_SUBTITLE}</p>
          <p className="text-terracotta-600 text-xs mt-2">{AGREEMENT_DRAFT_NOTE}</p>
        </header>

        <div className="space-y-6">
          {AGREEMENT_SECTIONS.map((s) => (
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

        <p className="text-xs text-ink-subtle mt-10">גרסה: {AGREEMENT_VERSION}</p>
      </div>
    </div>
  );
}
