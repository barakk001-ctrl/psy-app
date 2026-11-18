import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { IntroEdit, IntroStepper } from "@/components/intro/intro-screens";
import { INTRO_QUESTIONS, INTRO_TITLE, introAnswers, isIntroQuestionId } from "@/lib/intro";
import { MY_CLINIC_PATH, MY_CLINIC_TITLE } from "@/lib/my-clinic";
import { subscriptionStateFor } from "@/lib/subscription-server";

/**
 * The שאלון היכרות (src/lib/intro.ts): a few questions about the practice
 * itself, never about clients. With no `q` it is the whole questionnaire, a
 * question per screen; with `?q=<id>` it edits that one answer, which is how
 * each row of the card on "המרפאה שלי" is changed later.
 */
export const metadata = { title: `${INTRO_TITLE} — מרפאה אישית` };

export default async function IntroPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // A read-only account could save none of it
  const sub = await subscriptionStateFor(userId);
  if (!sub.writable) redirect(MY_CLINIC_PATH);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      clinicType: true,
      clientGroups: true,
      workingHours: true,
      dashboardFocus: true,
      defaultSessionMinutes: true,
      defaultRate: true,
    },
  });
  if (!user) return null;
  const answers = introAnswers({ ...user, defaultRate: user.defaultRate ? user.defaultRate.toString() : null });

  const { q } = await searchParams;
  const one = isIntroQuestionId(q) ? q : null;

  return (
    <div className="max-w-xl space-y-5">
      <header>
        <Link
          href={`${MY_CLINIC_PATH}#intro`}
          className="inline-flex min-h-9 items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ChevronRight className="w-4 h-4" aria-hidden /> {MY_CLINIC_TITLE}
        </Link>
        <h1 className="font-display text-3xl text-ink">{INTRO_TITLE}</h1>
        {!one && (
          <p className="text-ink-muted text-sm mt-1">
            {INTRO_QUESTIONS.length} שאלות קצרות על המרפאה עצמה, לא על לקוחות. כשתי דקות. אפשר לדלג על כל שאלה,
            ולשנות כל תשובה אחר כך מ״{MY_CLINIC_TITLE}״.
          </p>
        )}
      </header>
      {one ? <IntroEdit question={one} initial={answers} /> : <IntroStepper initial={answers} />}
    </div>
  );
}
