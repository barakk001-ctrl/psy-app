import Link from "next/link";
import { PRIVACY_DRAFT_NOTE, PRIVACY_SECTIONS, PRIVACY_SUBTITLE, PRIVACY_TITLE, PRIVACY_VERSION } from "@/lib/privacy";

// Public page, like /agreement and /terms: readable by everyone (auth-gate lets it through),
// and linked from Google's consent screen.
export const metadata = { title: `${PRIVACY_TITLE} — מרפאה` };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-cream-50">
      <div className="max-w-2xl mx-auto px-5 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl text-ink">{PRIVACY_TITLE}</h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">{PRIVACY_SUBTITLE}</p>
          <p className="text-terracotta-600 text-xs mt-2">{PRIVACY_DRAFT_NOTE}</p>
        </header>

        <div className="space-y-6">
          {PRIVACY_SECTIONS.map((s) => (
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
          {" · "}
          <Link href="/terms" className="underline underline-offset-2">
            תנאי שימוש
          </Link>
        </p>
        <p className="text-xs text-ink-subtle mt-4">גרסה: {PRIVACY_VERSION}</p>
      </div>
    </div>
  );
}
