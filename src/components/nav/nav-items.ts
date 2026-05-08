import { LayoutDashboard, Users, Calendar, FileText, BarChart3, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Show in the bottom tab bar on mobile? Limit to ~4 items for fit. */
  primaryMobile?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "סקירה", icon: LayoutDashboard, primaryMobile: true },
  { href: "/calendar", label: "יומן", icon: Calendar, primaryMobile: true },
  { href: "/clients", label: "לקוחות", icon: Users, primaryMobile: true },
  { href: "/invoices", label: "חשבוניות", icon: FileText, primaryMobile: true },
  { href: "/reports", label: "דוחות", icon: BarChart3 },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

export const PRIMARY_MOBILE_ITEMS = NAV_ITEMS.filter((i) => i.primaryMobile);
