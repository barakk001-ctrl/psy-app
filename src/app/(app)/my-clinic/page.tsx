import Link from "next/link";
import {
  Building2,
  FileText,
  Image as ImageIcon,
  Pencil,
  Phone,
  Settings,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { documentsEnabled } from "@/lib/features";
import { MEETING_TYPE_COLORS } from "@/lib/meeting-type-colors";
import {
  MY_CLINIC_TITLE,
  NOT_SET,
  myClinicSections,
  type MyClinicRow,
  type MyClinicSectionId,
} from "@/lib/my-clinic";

/**
 * "המרפאה שלי": the clinic's own settings on one page (name, logo, contact
 * details, meeting types, payment details and — with documents on — the
 * document design). A summary only: each card links to the section of
 * "הגדרות" where that setting is stored and edited (src/lib/my-clinic.ts).
 */
export const metadata = { title: `${MY_CLINIC_TITLE} — מרפאה אישית` };

const ICONS: Record<MyClinicSectionId, LucideIcon> = {
  name: Building2,
  logo: ImageIcon,
  contact: Phone,
  "meeting-types": Tags,
  payment: Wallet,
  documents: FileText,
};

const EDIT_LINK =
  "inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-cream-300 bg-white/70 text-ink shadow-soft transition-colors hover:bg-white hover:border-cream-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100";

function Row({ row, title }: { row: MyClinicRow; title: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">{row.label}</dt>
        <dd className={row.value ? "text-sm text-ink break-words" : "text-sm text-ink-muted"}>
          {row.value ? row.ltr ? <bdi dir="ltr">{row.value}</bdi> : row.value : NOT_SET}
        </dd>
      </div>
      {row.href && (
        <Link
          href={row.href}
          aria-label={`עריכה: ${title}, ${row.label}`}
          className={`${EDIT_LINK} h-8 px-2.5 text-xs font-medium`}
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden /> עריכה
        </Link>
      )}
    </div>
  );
}

export default async function MyClinicPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user, meetingTypes] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        brandName: true,
        businessName: true,
        logoUrl: true,
        phone: true,
        address: true,
        website: true,
        docEmail: true,
        businessId: true,
        defaultRate: true,
        vatLiable: true,
        defaultSessionMinutes: true,
        docTemplate: true,
        docColor: true,
        signatureUrl: true,
        logoOnDocuments: true,
      },
    }),
    db.meetingType.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    }),
  ]);
  if (!user) return null;

  const sections = myClinicSections(
    { ...user, defaultRate: user.defaultRate ? user.defaultRate.toString() : null },
    meetingTypes,
    documentsEnabled(),
  );

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">{MY_CLINIC_TITLE}</h1>
        <p className="text-ink-muted text-sm mt-1">
          ההגדרות האישיות של הקליניקה במקום אחד. העריכה נעשית במסך ההגדרות, וכל כרטיס מוביל
          ישר למקום שלו.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => {
          const Icon = ICONS[s.id];
          // A card whose rows are edited in different places has a link per row
          const rowLinks = s.rows.some((r) => r.href);
          return (
            <Card key={s.id} id={s.id} className="scroll-mt-24">
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage-50 text-sage-600">
                      <Icon className="w-4 h-4" aria-hidden />
                    </span>
                    <h2 className="font-display text-xl text-ink leading-tight">{s.title}</h2>
                  </div>
                  {!rowLinks && (
                    <Link
                      href={s.href}
                      aria-label={`עריכה: ${s.title}`}
                      className={`${EDIT_LINK} h-9 px-3 text-sm font-medium`}
                    >
                      <Pencil className="w-3.5 h-3.5" aria-hidden /> עריכה
                    </Link>
                  )}
                </div>
                <p className="text-xs text-ink-muted">{s.hint}</p>

                {s.id === "logo" ? (
                  <div className="flex items-center gap-3 pt-1">
                    {s.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for next/image to optimise
                      <img
                        src={s.image}
                        alt="הלוגו של הקליניקה"
                        className="h-16 w-16 rounded-2xl object-cover bg-white ring-1 ring-cream-200"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="grid h-16 w-16 place-items-center rounded-2xl border border-dashed border-cream-300 text-ink-muted"
                      >
                        <ImageIcon className="w-5 h-5" />
                      </span>
                    )}
                    <p className={s.image ? "text-sm text-ink" : "text-sm text-ink-muted"}>
                      {s.image ? "הלוגו הועלה" : "עוד לא הועלה לוגו"}
                    </p>
                  </div>
                ) : (
                  <dl className="divide-y divide-cream-200/80">
                    {s.rows.map((r) => (
                      <Row key={r.label} row={r} title={s.title} />
                    ))}
                  </dl>
                )}

                {s.chips &&
                  (s.chips.length ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label="סוגי המפגשים">
                      {s.chips.map((c) => (
                        <li
                          key={c.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-cream-50 px-2.5 py-1 text-xs text-ink"
                        >
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: c.color ?? MEETING_TYPE_COLORS[0] }}
                          />
                          {c.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-muted">עוד לא הוגדרו סוגי מפגשים</p>
                  ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Link
        href="/settings"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-sage-600 hover:text-sage-700"
      >
        <Settings className="w-4 h-4" aria-hidden /> לכל ההגדרות
      </Link>
    </div>
  );
}
