import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import {
  TERMS_DRAFT_NOTE,
  TERMS_SECTIONS,
  TERMS_SUBTITLE,
  TERMS_TITLE,
  TERMS_VERSION,
} from "@/lib/terms";

// Public page, like /agreement: readable by everyone (auth-gate lets it through),
// and linked from Google's consent screen.
export const metadata = { title: `${TERMS_TITLE} — מרפאה` };

export default function TermsPage() {
  return (
    <LegalPage
      title={TERMS_TITLE}
      barTitle="תנאי שימוש"
      subtitle={TERMS_SUBTITLE}
      draftNote={TERMS_DRAFT_NOTE}
      sections={TERMS_SECTIONS}
      version={TERMS_VERSION}
      footer={
        <p className="text-sm text-ink-soft mt-8">
          ראו גם:{" "}
          <Link href="/agreement" className="underline underline-offset-2">
            הסכם החזקת מידע
          </Link>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-2">
            מדיניות פרטיות
          </Link>
        </p>
      }
    />
  );
}
