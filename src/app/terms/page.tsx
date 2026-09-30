import Link from "next/link";
import { TERMS_DRAFT_NOTE, TERMS_SECTIONS, TERMS_SUBTITLE, TERMS_TITLE, TERMS_VERSION } from "@/lib/terms";

// Public page, like /agreement: readable by everyone (auth-gate lets it through),
// and linked from Google's consent screen.
export const metadata = { title: `${TERMS_TITLE} — מרפאה` };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-ink">{TERMS_TITLE}</h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">{TERMS_SUBTITLE}</p>
          <p className="text-terracotta-600 text-xs mt-2">{TERMS_DRAFT_NOTE}</p>
        </header>

        <div className="space-y-6">
          {TERMS_SECTIONS.map((s) => (
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

        <p className="text-sm text-ink-soft mt-8">
          ראו גם:{" "}
          <Link href="/agreement" className="underline underline-offset-2">
            הסכם החזקה ועיבוד של מידע
          </Link>
        </p>
        <p className="text-xs text-ink-subtle mt-4">גרסה: {TERMS_VERSION}</p>
      </div>
    </div>
  );
}
