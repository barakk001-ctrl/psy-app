import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { ClientForm } from "@/components/clients/client-form";

export default function NewClientPage() {
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
      <ClientForm />
    </div>
  );
}
