// The interface's colour sets (the שאלון היכרות's sixth question,
// User.colorTheme). A set replaces the app's accent scale — the six "sage"
// shades every button, link, chart bar and highlight is drawn with — and
// nothing else: the page's creams, the text's inks and the terracotta of
// warnings and errors are the same in every set, so a warning looks like a
// warning whatever the colour. No free colour picker: each set is checked for
// text contrast in color-themes.test.ts.
//
// How it reaches the screen: tailwind.config.ts draws `sage-*` from the CSS
// variables `--sage-*` (space-separated RGB channels, so opacity modifiers keep
// working); globals.css sets them to the default set on :root; a signed-in
// layout renders <ThemeStyle>, a <style> that overrides them for the chosen
// set. Signed-out pages, e-mails, PDFs and the logo keep the default colours.
// Pure; tested.

export const SHADES = [50, 100, 300, 500, 600, 700] as const;
export type Shade = (typeof SHADES)[number];
export type Scale = Record<Shade, string>;

export type ColorTheme = { id: string; label: string; scale: Scale };

export const DEFAULT_THEME_ID = "sage";

export const COLOR_THEMES = [
  {
    id: "sage",
    label: "מרווה",
    scale: { 50: "#F1F4ED", 100: "#DCE3D2", 300: "#A8B79C", 500: "#5C7559", 600: "#4A6048", 700: "#3A4B39" },
  },
  {
    id: "ocean",
    label: "כחול ים",
    scale: { 50: "#EEF3F7", 100: "#D6E2EC", 300: "#9FB7CB", 500: "#4E7191", 600: "#3F5D79", 700: "#31485E" },
  },
  {
    id: "teal",
    label: "טורקיז",
    scale: { 50: "#ECF5F4", 100: "#D1E6E3", 300: "#93BDB8", 500: "#3C7872", 600: "#30625D", 700: "#264D49" },
  },
  {
    id: "lavender",
    label: "לבנדר",
    scale: { 50: "#F2F1F8", 100: "#DFDCEE", 300: "#B0AACF", 500: "#6B6399", 600: "#57507F", 700: "#443E64" },
  },
  {
    id: "mauve",
    label: "ורוד עתיק",
    scale: { 50: "#F8F0F4", 100: "#EDDAE4", 300: "#CDA5BA", 500: "#935A79", 600: "#7A4964", 700: "#60394F" },
  },
  {
    id: "slate",
    label: "אפור כחלחל",
    scale: { 50: "#F1F3F5", 100: "#DDE2E6", 300: "#A9B4BC", 500: "#5A6875", 600: "#495560", 700: "#39434C" },
  },
] as const satisfies readonly ColorTheme[];

export type ColorThemeId = (typeof COLOR_THEMES)[number]["id"];

/** The stored value read back: a known set's id, or null (= the default set). */
export function cleanColorTheme(v: unknown): ColorThemeId | null {
  const found = COLOR_THEMES.find((t) => t.id === v);
  return found && found.id !== DEFAULT_THEME_ID ? found.id : null;
}

export function colorTheme(v: unknown): (typeof COLOR_THEMES)[number] {
  return COLOR_THEMES.find((t) => t.id === v) ?? COLOR_THEMES[0];
}

/** "#5C7559" → "92 117 89", the form `rgb(var(--x) / <alpha>)` takes. */
export function channels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** The set as CSS variables: [["--sage-50", "241 244 237"], …]. */
export function themeVars(v: unknown): [string, string][] {
  const { scale } = colorTheme(v);
  return SHADES.map((s) => [`--sage-${s}`, channels(scale[s])]);
}

/**
 * The <style> text that switches a page to the set, or null for the default
 * set (globals.css already holds it). Built only from the constants above —
 * never from the stored value itself.
 */
export function themeCss(v: unknown): string | null {
  if (!cleanColorTheme(v)) return null;
  return `:root{${themeVars(v)
    .map(([name, value]) => `${name}:${value}`)
    .join(";")}}`;
}

/** The set's main shade as a hex colour, for code that computes with colours
 *  (the calendar darkens a pill's background until its text is readable). */
export function themeAccent(v: unknown): string {
  return colorTheme(v).scale[500];
}
