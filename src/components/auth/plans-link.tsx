import Link from "next/link";

/**
 * The way from /register to the plans ("מסלולים", the home page's #plans
 * section): a full-width outlined button under the join box, so the switch's
 * "הצטרפות ומסלולים" leads somewhere visible. The cards themselves are not
 * embedded here: the auth pages must fit one screen on a laptop.
 */
export function PlansLink() {
  return (
    <Link
      href="/#plans"
      className="auth-plans-link mt-4 flex h-11 w-full items-center justify-center rounded-xl border border-cream-300 bg-white/70 text-sm font-medium text-ink hover:border-sage-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100"
    >
      מסלולים
    </Link>
  );
}
