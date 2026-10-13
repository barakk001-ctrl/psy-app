import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { getMeetingTypeNames } from "@/lib/meeting-types";
import { splitFullName } from "@/lib/waitlist";
import { ClientForm } from "@/components/clients/client-form";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    nextStart?: string;
    fromWaitlist?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user.id;
  const meetingTypes = await getMeetingTypeNames(userId);

  // "הפיכה ללקוח" from the waiting list: prefill from the entry (her own only)
  const entry = params.fromWaitlist
    ? await db.waitlistEntry.findFirst({
        where: { id: params.fromWaitlist, userId },
        select: { id: true, fullName: true, phone: true, notesCiphertext: true },
      })
    : null;
  let defaults: { firstName?: string; lastName?: string; phone?: string; generalNotes?: string };
  if (entry) {
    let notes = "";
    try {
      notes = entry.notesCiphertext ? decryptSecret(entry.notesCiphertext) : "";
    } catch {
      notes = "";
    }
    defaults = { ...splitFullName(entry.fullName), phone: entry.phone ?? "", generalNotes: notes };
  } else {
    defaults = { firstName: params.firstName, lastName: params.lastName, phone: params.phone };
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={entry ? "/clients?view=waitlist" : "/clients"}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        {entry ? "חזרה לרשימת ההמתנה" : "חזרה לרשימת הלקוחות"}
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">לקוח חדש</h1>
        <p className="text-ink-muted text-sm mt-1">
          {entry
            ? "הפרטים מרשימת ההמתנה כבר מולאו — אפשר להשלים ולשמור. אחרי השמירה הרשומה תוסר מרשימת ההמתנה."
            : "רק שם פרטי ושם משפחה הם חובה. כל היתר אופציונלי וניתן להשלים מאוחר יותר."}
        </p>
      </header>
      <ClientForm
        meetingTypes={meetingTypes}
        defaults={defaults}
        nextStart={params.nextStart}
        waitlistId={entry?.id}
      />
    </div>
  );
}
