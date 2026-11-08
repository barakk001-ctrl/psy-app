import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { ExplainerVideo } from "@/components/auth/explainer-video";
import { LogoMark, Wordmark } from "@/components/brand/logo-mark";
import { ClinicHero } from "@/components/dashboard/clinic-hero";
import { PublicFooter } from "@/components/legal/public-footer";
import { SkipLink } from "@/components/ui/skip-link";
import { PLAN_OPTIONS, TRIAL_PLAN } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/subscription";
import deskCalendar from "./desk-calendar.jpg";
import deskClient from "./desk-client.jpg";
import deskReports from "./desk-reports.jpg";
import phoneCalendar from "./phone-calendar.jpg";

// The public home for signed-out visitors. Every claim here must be true of the
// code today: keep it in step with the product, and keep the "כדאי לדעת" list
// honest (automatic reminders and morning are not promised). The screenshots
// are of the made-up practice from scripts/explainer/seed.cjs — never real data.

const CTA_PRIMARY =
  "inline-flex items-center justify-center h-12 px-6 rounded-xl font-medium text-base bg-gradient-to-b from-sage-500 to-sage-600 text-cream-50 shadow-glow hover:from-sage-600 hover:to-sage-700";

type Feature = {
  title: string;
  points: string[];
  image: StaticImageData;
  alt: string;
};

const FEATURES: Feature[] = [
  {
    title: "כל הפגישות ביומן אחד",
    points: [
      "פגישות קבועות כל שבוע או כל שבועיים, גם בלי תאריך סיום.",
      "שינוי מועד לפגישה אחת, או לכל הפגישות הבאות באותה משבצת.",
      "אזהרה על חפיפה עוד לפני השמירה.",
      "כל סוג מפגש בצבע משלו, ומועדי ישראל ביומן.",
    ],
    image: deskCalendar,
    alt: "תצוגת שבוע ביומן, עם פגישות לדוגמה בצבעים לפי סוג המפגש",
  },
  {
    title: "תיק לכל לקוח/ה",
    points: [
      "פרטים, היסטוריית פגישות ומסמכים: PDF, Word ותמונות.",
      "סיכומי פגישות מוצפנים, עם ייצוא ל-PDF.",
      "ליד כל פגישה רואים אם חסר תיעוד או תשלום.",
      "רשימת המתנה, והפיכה ללקוח/ה בלחיצה.",
    ],
    image: deskClient,
    alt: "תיק של לקוחה לדוגמה, עם סיכומי פגישות ופרטי קשר",
  },
  {
    title: "תשלומים והכנסות, בלי טבלה בצד",
    points: [
      "רישום תשלום לכל פגישה, כולל אמצעי התשלום.",
      "רשימה של הפגישות שעוד לא עודכן בהן תשלום.",
      "הכנסה צפויה מול הכנסה בפועל, חודש אחרי חודש.",
      "דוחות לפי תקופה, לקוח/ה ואמצעי תשלום, עם ייצוא ל-PDF.",
    ],
    image: deskReports,
    alt: "עמוד הדוחות, עם תרשים הכנסות של נתונים לדוגמה",
  },
];

const SECURITY: { title: string; text: string }[] = [
  {
    title: "הסיכומים מוצפנים",
    text: "סיכומי הפגישות, הקבצים והמסמכים נשמרים מוצפנים (AES-256-GCM), לא כטקסט גלוי.",
  },
  {
    title: "רואים מי נכנס לאן",
    text: "כל צפייה או שינוי בתוכן קליני נרשמים ביומן גישה, שאפשר לעיין בו בהגדרות.",
  },
  {
    title: "כניסה מוגנת",
    text: "אימות דו-שלבי, נעילת Face ID באפליקציה, וניתוק אוטומטי אחרי זמן ללא פעילות.",
  },
  {
    title: "שרתים באירופה",
    text: "השרת ובסיס הנתונים פועלים באיחוד האירופי, והמידע מגובה מדי יום.",
  },
  {
    title: "המידע נשאר שלך",
    text: "גם אם המנוי מסתיים לא נחסמים: הכול נשאר זמין לצפייה ולייצוא.",
  },
];

const GOOD_TO_KNOW: string[] = [
  "תזכורות אוטומטיות ללקוחות עדיין לא פעילות. אפשר לשלוח תזכורת בוואטסאפ בלחיצה, מהודעה מוכנה.",
  "המערכת לא מפיקה מסמכי מס בעצמה. אפשר לרשום לכל פגישה את מספרי המסמכים מ-morning.",
  "החיבור הישיר ל-morning עדיין בבדיקות, ולכן אין להסתמך עליו בשלב זה.",
  `בתקופת הניסיון אפשר לקבוע פגישות עד ${TRIAL_DAYS} יום קדימה.`,
];

/** What the silent video shows, for anyone who can't watch it. */
const VIDEO_TEXT: string[] = [
  "כניסה מאובטחת: סיסמה, אימות דו-שלבי ונעילת Face ID.",
  "מסך הבית: הפגישות של היום, ההכנסות והמשימות, וליד כל פגישה מה חסר.",
  "היומן: כל סוג מפגש בצבע משלו, מועדי ישראל, ותצוגות שבוע ויום בלי גלילה.",
  "עריכה מהירה: לחיצה על פגישה ושינוי מועד לפגישה אחת או לכל הבאות.",
  "תיקי לקוחות, רשימת המתנה ותיעוד פגישות.",
  "אישורי תשלום: אילו פגישות עוד לא שולמו.",
  "מסך ״מסמך חדש״ להכנת קבלה או חשבונית (ההפקה דרך morning עדיין בבדיקות).",
  "דוחות הכנסות עם ייצוא ל-PDF.",
  "מסלולים, פרטיות ואבטחה.",
];

export function LandingPage({ byInvite }: { byInvite: boolean }) {
  const ctaLabel = byInvite ? "בקשת הצטרפות" : `התחלת ${TRIAL_DAYS} יום חינם`;

  return (
    <div className="landing-page min-h-screen bg-cream-50 text-ink">
      <SkipLink />

      <header className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label="מרפאה אישית, עמוד הבית">
          <LogoMark size={40} />
          <Wordmark className="text-xl" />
        </Link>
        <nav aria-label="ראשי" className="flex items-center gap-5 text-sm font-medium">
          <Link href="/pricing" className="text-ink-soft hover:text-ink">
            מסלולים
          </Link>
          <Link href="/login" className="text-sage-600 hover:text-sage-700">
            כניסה
          </Link>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1}>
        {/* The hero is the logo's own room, with the app standing in it */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-8 grid md:grid-cols-[1.05fr_1fr] gap-10 md:gap-6 items-center">
          <div>
            <h1 className="font-display font-extrabold text-5xl sm:text-6xl leading-[1.08] tracking-tight text-balance">
              הקליניקה שלך, מסודרת.
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-ink-soft leading-relaxed max-w-lg">
              יומן, תיקי לקוחות, סיכומי פגישות ומעקב תשלומים. מערכת בעברית למטפלים עצמאיים
              בישראל, בטלפון ובמחשב.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/register" className={CTA_PRIMARY}>
                {ctaLabel}
              </Link>
              <ExplainerVideo
                label="צפייה בהדגמה"
                className="inline-flex items-center gap-2 h-12 text-base text-sage-700 hover:text-sage-600 font-medium"
              />
            </div>
            <p className="mt-4 text-sm text-ink-muted">
              {TRIAL_DAYS} יום חינם, בלי כרטיס אשראי.
              {byInvite ? " ההרשמה כרגע בהזמנה בלבד." : ""}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <ClinicHero className="w-full h-auto" />
            {/* On the window side, so the sofa from the logo stays in view */}
            <div className="absolute end-[3%] -bottom-6 sm:-bottom-8 w-[36%]">
              <div className="rounded-[1.6rem] border-[5px] border-ink bg-ink overflow-hidden shadow-lift">
                <Image
                  src={phoneCalendar}
                  alt="היומן בטלפון, עם פגישות לדוגמה"
                  sizes="(min-width: 768px) 180px, 40vw"
                  placeholder="blur"
                  priority
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="what-title" className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24">
          <h2 id="what-title" className="sr-only">
            מה יש במערכת
          </h2>
          <div className="space-y-14 sm:space-y-20">
            {FEATURES.map((f, i) => (
              <article key={f.title} className="grid md:grid-cols-[1fr_1.35fr] gap-6 md:gap-10 items-center">
                <div className={i % 2 === 1 ? "md:order-last" : undefined}>
                  <h3 className="font-display font-bold text-2xl sm:text-3xl leading-tight">{f.title}</h3>
                  <ul className="mt-4 space-y-2 text-ink-soft leading-relaxed list-disc ps-5 marker:text-sage-500">
                    {f.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
                <Image
                  src={f.image}
                  alt={f.alt}
                  sizes="(min-width: 768px) 560px, 100vw"
                  placeholder="blur"
                  className="w-full h-auto rounded-xl border border-cream-300 shadow-soft"
                />
              </article>
            ))}
          </div>
          <p className="mt-8 text-sm text-ink-muted">כל השמות והנתונים בתמונות מומצאים.</p>
        </section>

        <section
          aria-labelledby="video-title"
          className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 grid md:grid-cols-[1fr_1.35fr] gap-6 md:gap-10 items-start"
        >
          <div>
            <h2 id="video-title" className="font-display font-bold text-2xl sm:text-3xl">
              דקה וחצי בתוך המערכת
            </h2>
            <p className="mt-2 text-ink-soft">סיור קצר עם כיתובים, בלי קול.</p>
            <details className="mt-4 text-ink-soft">
              <summary className="cursor-pointer font-medium text-sage-700">מה רואים בסרטון</summary>
              <ul className="mt-3 space-y-1.5 leading-relaxed list-disc ps-5">
                {VIDEO_TEXT.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </details>
          </div>
          <ExplainerVideo
            label=""
            className="group relative block w-full rounded-xl overflow-hidden border border-cream-300 shadow-soft"
          >
            <Image
              src={deskCalendar}
              alt=""
              sizes="(min-width: 768px) 560px, 100vw"
              placeholder="blur"
              className="w-full h-auto"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-ink/25 group-hover:bg-ink/35">
              <span className="inline-flex items-center gap-2 rounded-xl bg-sage-700 text-cream-50 font-medium px-5 h-12">
                <PlayCircle className="w-6 h-6" aria-hidden />
                צפייה בסרטון ההסבר
              </span>
            </span>
          </ExplainerVideo>
        </section>

        <section aria-labelledby="plans-title" className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24">
          <h2 id="plans-title" className="font-display font-bold text-2xl sm:text-3xl">
            מתחילים חינם, וממשיכים רק אם מתאים
          </h2>
          <p className="mt-2 text-ink-soft max-w-2xl">
            כל המסלולים כוללים את כל המערכת. המנוי לא מתחדש אוטומטית.
          </p>
          <dl className="mt-6 grid sm:grid-cols-3 gap-px rounded-2xl overflow-hidden border border-cream-300 bg-cream-300">
            <div className="bg-white p-5">
              <dt className="font-display font-bold text-lg">{TRIAL_PLAN.title}</dt>
              <dd className="mt-2 text-3xl font-display font-bold">₪{TRIAL_PLAN.price}</dd>
              <dd className="text-sm text-ink-muted mt-1">{TRIAL_PLAN.per}, בלי כרטיס אשראי</dd>
            </div>
            {PLAN_OPTIONS.map((p) => (
              <div key={p.id} className="bg-white p-5">
                <dt className="font-display font-bold text-lg">{p.title}</dt>
                <dd className="mt-2 text-3xl font-display font-bold">
                  ₪{p.price}{" "}
                  <span className="text-sm font-sans font-normal text-ink-muted line-through">
                    <span className="sr-only">מחיר רגיל: </span>₪{p.regularPrice}
                  </span>
                </dd>
                <dd className="text-sm text-ink-muted mt-1">{p.per}, מחיר היכרות</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4">
            <Link href="/pricing" className="font-medium text-sage-700 underline underline-offset-2">
              כל הפרטים במסלולים ומחירים
            </Link>
          </p>
        </section>

        {/* One deep band, like the sign-in brand panel: this is the part a
            therapist has to be able to trust */}
        <section aria-labelledby="privacy-title" className="mt-16 sm:mt-24 bg-sage-700 text-cream-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <h2 id="privacy-title" className="font-display font-bold text-2xl sm:text-3xl">
              פרטיות ואבטחה, בשפה פשוטה
            </h2>
            <dl className="mt-7 grid sm:grid-cols-2 gap-x-10 gap-y-6">
              {SECURITY.map((s) => (
                <div key={s.title}>
                  <dt className="font-medium text-gold-200">{s.title}</dt>
                  <dd className="mt-1 text-cream-50/95 leading-relaxed">{s.text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 text-sm text-cream-50/95">
              כל הפרטים ב
              <Link href="/privacy" className="underline underline-offset-2">
                מדיניות הפרטיות
              </Link>{" "}
              וב
              <Link href="/agreement" className="underline underline-offset-2">
                הסכם החזקת המידע
              </Link>
              .
            </p>
          </div>
        </section>

        <section aria-labelledby="know-title" className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20">
          <h2 id="know-title" className="font-display font-bold text-2xl sm:text-3xl">
            כדאי לדעת
          </h2>
          <ul className="mt-4 max-w-2xl space-y-2 text-ink-soft leading-relaxed list-disc ps-5 marker:text-sage-500">
            {GOOD_TO_KNOW.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 text-center">
          <h2 className="font-display font-bold text-3xl sm:text-4xl text-balance">
            רוצים לנסות?
          </h2>
          <p className="mt-3 text-ink-soft">
            {byInvite
              ? `ההרשמה כרגע בהזמנה בלבד. אחרי ההצטרפות עובדים ${TRIAL_DAYS} יום בחינם.`
              : `נרשמים ועובדים ${TRIAL_DAYS} יום בחינם, בלי כרטיס אשראי.`}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/register" className={CTA_PRIMARY}>
              {ctaLabel}
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            כבר יש לך חשבון?{" "}
            <Link href="/login" className="text-sage-700 font-medium underline underline-offset-2">
              כניסה
            </Link>
          </p>
        </section>
      </main>

      <PublicFooter className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-8" />
    </div>
  );
}
