import Link from "next/link";
import { cn } from "@/lib/utils";
import { authSwitchHref, type AuthPage } from "@/lib/auth-switch";

const TABS: { page: AuthPage; label: string }[] = [
  { page: "login", label: "כניסה" },
  { page: "register", label: "הצטרפות ומסלולים" },
];

/**
 * Two side-by-side boxes under the logo on /login and /register (the second
 * also leads to the plans: /register has a "מסלולים" button). They are
 * plain links (the pages are separate), the current one filled and marked
 * aria-current, the other outlined. First in the DOM = on the right in RTL.
 */
export function AuthSwitch({
  current,
  searchParams,
}: {
  current: AuthPage;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return (
    <nav aria-label="כניסה או הצטרפות ומסלולים" className="auth-switch mb-8 lg:mb-auth-xl">
      <ul className="grid grid-cols-2 gap-2 sm:gap-3">
        {TABS.map((t) => {
          const on = t.page === current;
          return (
            <li key={t.page}>
              <Link
                href={authSwitchHref(t.page, searchParams)}
                aria-current={on ? "page" : undefined}
                className={cn(
                  // The longer label stays on one line down to a 320px phone
                  "flex h-12 w-full items-center justify-center whitespace-nowrap rounded-xl border px-1 text-sm min-[400px]:text-base font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100",
                  on
                    ? "border-sage-600 bg-gradient-to-b from-sage-500 to-sage-600 text-cream-50 shadow-soft"
                    : "border-cream-300 bg-white/70 text-ink hover:border-sage-300 hover:bg-white",
                )}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
