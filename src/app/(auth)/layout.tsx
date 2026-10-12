import Image from "next/image";
import { BrandEmblem } from "@/components/auth/brand-emblem";
import therapyRoom from "@/components/auth/login-room.jpg";
import { copyrightYears } from "@/lib/copyright";

// Shared by login, register, forgot/reset password and two-factor.
// lg+: the form is on the right (first column in RTL, ~42%) and the brand
// panel on the left (~58%), like the reference Keren chose.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.4fr]">
      {/* Brand panel: visible on lg+, second column = the left side. A real
          therapy room seen from the practitioner's desk, under a soft sage
          wash that deepens behind the text (contrast kept at WCAG AA there;
          the .auth-brand-wash layers are in globals.css). Photo: Franco
          Debartolo on Unsplash, Unsplash License (see CREDITS.md). */}
      <aside className="hidden lg:order-last lg:flex flex-col relative overflow-hidden bg-[#58786A] text-cream-50">
        <Image
          src={therapyRoom}
          alt=""
          fill
          priority
          // Hidden below lg, so phones fetch only the tiniest variant
          sizes="(min-width: 1024px) 58vw, 1px"
          quality={72}
          placeholder="blur"
          className="object-cover object-[50%_60%]"
        />
        <div className="auth-brand-wash absolute inset-0" aria-hidden />
        <div className="relative flex-1 flex flex-col items-center justify-center text-center px-10 pt-12 pb-44">
          <p className="font-display font-bold text-6xl xl:text-7xl leading-tight tracking-tight [text-shadow:0_2px_28px_rgba(20,30,22,0.35)]">
            מרפאה אישית
          </p>
          <div
            className="mt-6 h-0.5 w-28 rounded-full bg-gradient-to-r from-transparent via-gold-300 to-transparent"
            aria-hidden
          />
          <p className="mt-6 font-display text-2xl xl:text-3xl leading-snug max-w-xl text-balance [text-shadow:0_1px_16px_rgba(20,30,22,0.35)]">
            מערכת אחת לכל מה שהקליניקה שלך צריכה.
          </p>
          <p className="mt-4 text-base text-cream-50/95 leading-relaxed max-w-md text-balance [text-shadow:0_1px_12px_rgba(20,30,22,0.4)]">
            לקוחות, פגישות, סיכומים, חשבוניות ותשלומים — במקום אחד, בעברית, עם
            פרטיות שמתאימה למידע רפואי.
          </p>
        </div>
        <div className="relative pb-6 text-center text-xs text-cream-50/85">
          הסיכומים הקליניים מוצפנים ברמת היישום (AES-256-GCM)
        </div>
      </aside>

      {/* Form panel, with the copyright line at its foot */}
      <main className="flex flex-col min-h-screen px-4 sm:px-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-md">
            {/* On phones the brand panel is hidden: emblem and name above the form */}
            <div className="lg:hidden flex flex-col items-center text-center mb-8">
              <BrandEmblem className="w-28 text-sage-500" />
              <p className="mt-3 font-display font-bold text-3xl text-sage-700">מרפאה אישית</p>
            </div>
            {children}
          </div>
        </div>
        <footer className="w-full max-w-md mx-auto border-t border-cream-200 pt-4 text-center text-xs text-ink-muted">
          © כל הזכויות שמורות למרפאה אישית <span dir="ltr">{copyrightYears()}</span>
        </footer>
      </main>
    </div>
  );
}
