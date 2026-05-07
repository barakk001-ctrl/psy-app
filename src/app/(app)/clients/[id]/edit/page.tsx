import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ClientForm } from "@/components/clients/client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const client = await db.client.findFirst({
    where: { id, userId },
  });
  if (!client) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/clients/${client.id}`}
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה לכרטיס הלקוח/ה
      </Link>
      <header>
        <h1 className="font-display text-3xl text-ink">
          עריכת פרטים — {client.firstName} {client.lastName}
        </h1>
      </header>
      <ClientForm
        initial={{
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          idNumber: client.idNumber,
          email: client.email,
          phone: client.phone,
          dateOfBirth: client.dateOfBirth
            ? client.dateOfBirth.toISOString().slice(0, 10)
            : null,
          address: client.address,
          defaultRate: client.defaultRate ? client.defaultRate.toString() : null,
          generalNotes: client.generalNotes,
        }}
      />
    </div>
  );
}
