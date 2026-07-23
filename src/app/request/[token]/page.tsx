import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RequestForm } from "@/components/import/request-form";

export default async function AppointmentRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const user = await db.user.findUnique({
    where: { inboxToken: token },
    select: { businessName: true, name: true },
  });
  if (!user) notFound();

  const displayName = user.businessName ?? user.name;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center text-cream-50 font-display text-xl shadow-glow">
            מ
          </div>
          <h1 className="font-display text-2xl text-ink mt-3">
            בקשת פגישה — {displayName}
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            מלאו את הפרטים והבקשה תגיע ישירות אל {displayName}.
          </p>
        </header>

        <RequestForm token={token} />
      </div>
    </div>
  );
}
