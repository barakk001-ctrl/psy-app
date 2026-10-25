import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import {
  PRIVACY_DRAFT_NOTE,
  PRIVACY_SECTIONS,
  PRIVACY_SUBTITLE,
  PRIVACY_TITLE,
  PRIVACY_VERSION,
} from "@/lib/privacy";

// Public page, like /agreement and /terms: readable by everyone (auth-gate lets it
// through), and linked from Google's consent screen.
export const metadata = { title: `${PRIVACY_TITLE} — מרפאה` };

export default function PrivacyPage() {
  return (
    <LegalPage
      title={PRIVACY_TITLE}
      barTitle="מדיניות פרטיות"
      subtitle={PRIVACY_SUBTITLE}
      draftNote={PRIVACY_DRAFT_NOTE}
      sections={PRIVACY_SECTIONS}
      version={PRIVACY_VERSION}
      footer={
        <p className="text-sm text-ink-soft mt-8">
          ראו גם:{" "}
          <Link href="/agreement" className="underline underline-offset-2">
            הסכם החזקת מידע
          </Link>
          {" · "}
          <Link href="/terms" className="underline underline-offset-2">
            תנאי שימוש
          </Link>
        </p>
      }
    />
  );
}
