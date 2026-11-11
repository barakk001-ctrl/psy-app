import Image from "next/image";
import { LogoMark, Wordmark } from "@/components/brand/logo-mark";
import therapyRoom from "@/components/auth/login-room.jpg";
import { copyrightYears } from "@/lib/copyright";

// Shared by login, register, forgot/reset password and two-factor.
// lg+: the form is on the right (first column in RTL, ~42%) and the brand
// panel on the left (~58%), like the reference Keren chose. There the split is
// exactly one viewport high and the page never scrolls: the form column's
// sizes follow the viewport height (.auth-shell in globals.css, the
// lg:*-auth-* classes) and `short:` is a laptop window under 840px high.
// Phones keep their own layout and scroll as before.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell min-h-screen grid lg:grid-cols-[1fr_1.4fr]">
      {/* Brand panel: visible on lg+, second column = the left side. A real
          therapy room seen from the practitioner's desk, under a soft sage
          wash that deepens behind the text (contrast kept at WCAG AA there;
          the .auth-brand-wash layers are in globals.css). Photo: Franco
          Debartolo on Unsplash, Unsplash License (see CREDITS.md). */}
      <aside className="hidden lg:order-last lg:flex flex-col relative overflow-hidden min-h-0 bg-[#58786A] text-cream-50">
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
        <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center text-center px-10 pt-[clamp(1rem,5vh,3rem)] pb-[clamp(2rem,18vh,11rem)]">
          <LogoMark size={76} className="mb-6 short:mb-4 short:!w-14 short:!h-14" />
          <p className="font-display font-bold text-6xl xl:text-7xl short:text-5xl leading-tight tracking-tight [text-shadow:0_2px_28px_rgba(20,30,22,0.35)]">
            מרפאה <span className="font-medium text-gold-200">אישית</span>
          </p>
          <div
            className="mt-6 short:mt-4 h-0.5 w-28 rounded-full bg-gradient-to-r from-transparent via-gold-300 to-transparent"
            aria-hidden
          />
          <p className="mt-6 short:mt-4 font-display text-2xl xl:text-3xl short:text-2xl leading-snug max-w-xl text-balance [text-shadow:0_1px_16px_rgba(20,30,22,0.35)]">
            מערכת אחת לכל מה שהקליניקה שלך צריכה.
          </p>
          <p className="mt-4 short:mt-3 text-base text-cream-50/95 leading-relaxed max-w-md text-balance [text-shadow:0_1px_12px_rgba(20,30,22,0.4)]">
            לקוחות, פגישות, סיכומים, ניהול הכנסות והוצאות — במקום אחד, בעברית, עם
            פרטיות שמתאימה למידע רפואי.
          </p>
        </div>
        <div className="relative pb-6 short:pb-3 text-center text-xs text-cream-50/85">
          הסיכומים הקליניים מוצפנים ברמת היישום (AES-256-GCM)
        </div>
      </aside>

      {/* Form panel, with the copyright line at its foot */}
      <main className="auth-form flex flex-col min-h-screen px-4 sm:px-8 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-auth-md">
        {/* my-auto (not items-center): if the column ever has to scroll inside
            itself, its top stays reachable */}
        <div className="flex-1 flex justify-center py-10 lg:py-auth-pad">
          <div className="w-full max-w-md my-auto">
            {/* The mark and name above every form (on phones it is the only
                branding, since the brand panel is hidden there) */}
            <div className="flex flex-col items-center text-center mb-8 lg:mb-auth-lg short:flex-row short:justify-center short:gap-2.5">
              <LogoMark size={52} className="lg:hidden" />
              <LogoMark size={44} className="hidden lg:inline-flex lg:!w-auth-logo lg:!h-auth-logo" />
              <Wordmark className="mt-3 text-3xl lg:mt-2.5 lg:text-2xl short:mt-0" />
            </div>
            {children}
          </div>
        </div>
        <footer className="w-full max-w-md mx-auto border-t border-cream-200 pt-4 lg:pt-auth-md text-center text-xs text-ink-muted">
          © כל הזכויות שמורות למרפאה אישית <span dir="ltr">{copyrightYears()}</span>
        </footer>
      </main>
    </div>
  );
}
