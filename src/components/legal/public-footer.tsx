import Link from "next/link";
import { copyrightYears } from "@/lib/copyright";
import { OPERATOR_EMAIL, OPERATOR_FOOTER } from "@/lib/operator";

/** The foot of the public pages: legal links, copyright, the operator. */
export function PublicFooter({ className }: { className?: string }) {
  return (
    <footer className={className}>
      <div className="border-t border-cream-200 pt-4 text-center text-xs text-ink-muted space-y-1">
        <p>
          <Link href="/terms" className="underline underline-offset-2">
            תנאי שימוש
          </Link>
          {" · "}
          <Link href="/privacy" className="underline underline-offset-2">
            מדיניות פרטיות
          </Link>
          {" · "}
          <Link href="/agreement" className="underline underline-offset-2">
            הסכם החזקת מידע
          </Link>
          {" · "}
          <Link href="/accessibility" className="underline underline-offset-2">
            הצהרת נגישות
          </Link>
        </p>
        <p>
          © כל הזכויות שמורות למרפאה אישית <span dir="ltr">{copyrightYears()}</span>
        </p>
        <p>
          {OPERATOR_FOOTER} ·{" "}
          <a href={`mailto:${OPERATOR_EMAIL}`} className="underline underline-offset-2">
            <span dir="ltr">{OPERATOR_EMAIL}</span>
          </a>
        </p>
      </div>
    </footer>
  );
}
