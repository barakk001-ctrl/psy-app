import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import {
  ACCESSIBILITY_DRAFT_NOTE,
  ACCESSIBILITY_SECTIONS,
  ACCESSIBILITY_SUBTITLE,
  ACCESSIBILITY_TITLE,
  ACCESSIBILITY_VERSION,
} from "@/lib/accessibility";
import { OPERATOR_EMAIL } from "@/lib/operator";

// Public page, like /privacy and /terms: readable by everyone (auth-gate lets
// it through).
export const metadata = {
  title: `${ACCESSIBILITY_TITLE} — מרפאה אישית`,
  description: "מה נעשה כדי להנגיש את המערכת, מגבלות ידועות ואיך מדווחים על בעיה.",
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      title={ACCESSIBILITY_TITLE}
      barTitle="הצהרת נגישות"
      subtitle={ACCESSIBILITY_SUBTITLE}
      draftNote={ACCESSIBILITY_DRAFT_NOTE}
      sections={ACCESSIBILITY_SECTIONS}
      version={ACCESSIBILITY_VERSION}
      footer={
        <p className="text-sm text-ink-soft mt-8">
          לדיווח על בעיית נגישות:{" "}
          <a href={`mailto:${OPERATOR_EMAIL}`} className="underline underline-offset-2">
            <span dir="ltr">{OPERATOR_EMAIL}</span>
          </a>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-2">
            מדיניות פרטיות
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
