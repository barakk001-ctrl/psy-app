import { Home, Users, Calendar, FileInput, FileOutput, BarChart3, Settings, CreditCard, ListTodo } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { withoutDocumentLinks } from "@/lib/features";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show in the bottom tab bar on mobile? Limit to ~4 items for fit. */
  primaryMobile?: boolean;
  /** Carries the number of tasks due today or earlier (src/lib/tasks.ts) */
  taskBadge?: boolean;
};

export const TASKS_HREF = "/tasks";
/** The bottom tab bar holds this many tabs. */
const MOBILE_TABS = 4;

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: Home, primaryMobile: true },
  { href: "/calendar", label: "יומן", icon: Calendar, primaryMobile: true },
  { href: "/clients", label: "לקוחות", icon: Users, primaryMobile: true },
  { href: TASKS_HREF, label: "משימות", icon: ListTodo, primaryMobile: true, taskBadge: true },
  { href: "/invoices", label: "מסמכי הכנסות", icon: FileInput, primaryMobile: true },
  { href: "/expenses", label: "מסמכי הוצאות", icon: FileOutput },
  { href: "/reports", label: "פילוח ודוחות", icon: BarChart3 },
  { href: "/subscription", label: "מנוי ומסלולים", icon: CreditCard },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

/** The menu for this deployment: no document pages while they are hidden (src/lib/features.ts). */
export function navItems(documents: boolean): NavItem[] {
  return withoutDocumentLinks(NAV_ITEMS, documents);
}

/**
 * The bottom tab bar on phones. With the document pages shown there are five
 * candidates for four places: tasks then stay in the menu, as before.
 */
export function primaryMobileItems(documents: boolean): NavItem[] {
  const tabs = navItems(documents).filter((i) => i.primaryMobile);
  return tabs.length > MOBILE_TABS ? tabs.filter((i) => i.href !== TASKS_HREF) : tabs;
}
