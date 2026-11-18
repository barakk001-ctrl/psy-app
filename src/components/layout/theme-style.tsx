import { themeCss } from "@/lib/color-themes";

/**
 * The account's colour set (src/lib/color-themes.ts), for the signed-in
 * layouts: a <style> that overrides the accent variables on :root, so the whole
 * document follows — the page's background glow included. Renders nothing for
 * the default set. The text comes from constants, never from the stored value.
 */
export function ThemeStyle({ theme }: { theme: string | null | undefined }) {
  const css = themeCss(theme);
  return css ? <style>{css}</style> : null;
}
