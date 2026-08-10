import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { getMeetingTypeNames } from "@/lib/meeting-types";
import { ClientForm } from "@/components/clients/client-form";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{
    firstName?: string;
    lastName?: string;
    phone?: string;
    nextStart?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const meetingTypes = await getMeetingTypeNames(session!.user.id);
  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה לרשימת הלקוחות
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">לקוח חדש</h1>
        <p className="text-ink-muted text-sm mt-1">
          רק שם פרטי ושם משפחה הם חובה. כל היתר אופציונלי וניתן להשלים מאוחר יותר.
        </p>
      </header>
      <ClientForm
        meetingTypes={meetingTypes}
        defaults={{
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
        }}
        nextStart={params.nextStart}
      />
    </div>
  );
}
