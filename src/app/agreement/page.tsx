import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import {
  AGREEMENT_DRAFT_NOTE,
  AGREEMENT_SECTIONS,
  AGREEMENT_SUBTITLE,
  AGREEMENT_TITLE,
  AGREEMENT_VERSION,
} from "@/lib/agreement";

// Public page — linked from the registration checkbox (opened in a new tab, so
// the half-filled form stays), so it must be reachable without a session.
export const metadata = { title: `${AGREEMENT_TITLE} — מרפאה` };

export default function AgreementPage() {
  return (
    <LegalPage
      title={AGREEMENT_TITLE}
      barTitle="הסכם החזקת מידע"
      subtitle={AGREEMENT_SUBTITLE}
      draftNote={AGREEMENT_DRAFT_NOTE}
      sections={AGREEMENT_SECTIONS}
      version={AGREEMENT_VERSION}
      footer={
        <p className="text-sm text-ink-soft mt-8">
          ראו גם:{" "}
          <Link href="/terms" className="underline underline-offset-2">
            תנאי שימוש
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
