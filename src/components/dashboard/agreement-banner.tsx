import Link from "next/link";
import { FileSignature } from "lucide-react";
import { acceptAgreementAction } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";

/**
 * Shown on the dashboard whenever the user's accepted agreement version is
 * older than the current one (or was never recorded — pre-feature accounts).
 */
export function AgreementBanner() {
  return (
    <div className="rounded-2xl border border-sage-300 bg-sage-50 px-5 py-4 flex flex-wrap items-center gap-3">
      <FileSignature className="w-5 h-5 text-sage-700 shrink-0" />
      <p className="flex-1 min-w-56 text-sm text-ink-soft leading-relaxed">
        נוסח{" "}
        <Link
          href="/agreement"
          target="_blank"
          className="text-sage-700 font-medium hover:text-sage-600 underline underline-offset-2"
        >
          הסכם החזקת המידע
        </Link>{" "}
        עודכן — נדרש אישור מחדש כדי להמשיך להשתמש במערכת כרגיל.
      </p>
      <form action={acceptAgreementAction}>
        <Button type="submit" size="sm">
          קראתי — אני מאשר/ת
        </Button>
      </form>
    </div>
  );
}
