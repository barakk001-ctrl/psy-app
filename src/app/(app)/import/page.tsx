import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ImportMessageForm } from "@/components/import/import-message-form";

export default async function ImportPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [clients, inbox] = await Promise.all([
    db.client.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
    db.inboxMessage.findMany({
      where: { userId, processed: false },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, text: true, createdAt: true },
    }),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">ייבוא פגישה מהודעה</h1>
        <p className="text-ink-muted text-sm mt-1">
          מעתיקים הודעת וואטסאפ או אימייל עם פרטי הפגישה, מדביקים כאן — והאפליקציה
          מזהה את התאריך, השעה והלקוח/ה.
        </p>
      </header>

      <ImportMessageForm
        clients={clients}
        inbox={inbox.map((m) => ({
          id: m.id,
          text: m.text,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
