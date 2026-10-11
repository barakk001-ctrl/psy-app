import { BrandEmblem } from "@/components/auth/brand-emblem";
import { BrandScene } from "@/components/auth/brand-scene";
import { copyrightYears } from "@/lib/copyright";

// Shared by login, register, forgot/reset password and two-factor.
// lg+: the form is on the right (first column in RTL, ~42%) and the brand
// panel on the left (~58%), like the reference Keren chose.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.4fr]">
      {/* Brand panel: visible on lg+, second column = the left side */}
      <aside className="hidden lg:order-last lg:flex flex-col relative overflow-hidden bg-sage-700 text-cream-50">
        <BrandScene className="absolute inset-0 w-full h-full pointer-events-none" />
        <div className="relative flex-1 flex flex-col items-center justify-center text-center px-10 pt-12 pb-40">
          <p className="font-display font-bold text-6xl xl:text-7xl leading-tight tracking-tight [text-shadow:0_2px_24px_rgba(26,23,20,0.25)]">
            מרפאה אישית
          </p>
          <div className="mt-6 h-px w-20 bg-cream-50/35" aria-hidden />
          <p className="mt-6 font-display text-2xl xl:text-3xl leading-snug max-w-xl text-balance">
            מערכת אחת לכל מה שהקליניקה שלך צריכה.
          </p>
          <p className="mt-4 text-base text-sage-50/80 leading-relaxed max-w-md text-balance">
            לקוחות, פגישות, סיכומים, חשבוניות ותשלומים — במקום אחד, בעברית, עם
            פרטיות שמתאימה למידע רפואי.
          </p>
        </div>
        <div className="relative pb-6 text-center text-xs text-sage-50/60">
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
