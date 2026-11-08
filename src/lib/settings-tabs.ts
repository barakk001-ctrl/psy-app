// The tabs of the settings page (/settings?tab=<key>). Each card sits under one
// of them; a link to a card can carry its anchor too (/settings?tab=calendar
// #meeting-types), and the anchor alone also opens the right tab in the page.

export const SETTINGS_TABS = [
  { key: "personal", label: "פרטים אישיים" },
  { key: "business", label: "הגדרות עסק" },
  { key: "documents", label: "הגדרות מסמכים" },
  { key: "calendar", label: "יומן ופגישות" },
  { key: "security", label: "אבטחה וחשבון" },
  { key: "admin", label: "ניהול" },
] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]["key"];

export const DEFAULT_SETTINGS_TAB: SettingsTabKey = "personal";

/** The tabs this account sees: "ניהול" is for admins only. */
export function settingsTabs(isAdmin: boolean) {
  return SETTINGS_TABS.filter((t) => t.key !== "admin" || isAdmin);
}

/** The tab in the address, or the first one when it is missing or not this account's. */
export function parseSettingsTab(value: string | undefined | null, isAdmin: boolean): SettingsTabKey {
  return settingsTabs(isAdmin).find((t) => t.key === value)?.key ?? DEFAULT_SETTINGS_TAB;
}

/** A link to a tab, and to a card in it. */
export function settingsHref(tab: SettingsTabKey, anchor?: string): string {
  return `/settings?tab=${tab}${anchor ? `#${anchor}` : ""}`;
}
