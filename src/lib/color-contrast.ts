// WCAG contrast, for colours chosen at run time (calendar pills take the
// meeting type's colour and always carry light text). Pure; browser-safe.

function channels(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** The contrast ratio of two #rrggbb colours (1–21); 0 if one isn't valid. */
export function contrastRatio(a: string, b: string): number {
  const ca = channels(a);
  const cb = channels(b);
  if (!ca || !cb) return 0;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `bg`, darkened in small steps just enough for `text` to reach `ratio`.
 * The hue stays; a colour that already passes is returned as it was.
 */
export function darkenForText(bg: string, text: string, ratio = 4.5): string {
  const c = channels(bg);
  if (!c) return bg;
  if (contrastRatio(bg, text) >= ratio) return bg;
  for (let f = 0.97; f > 0; f -= 0.03) {
    const hex = `#${c
      .map((v) => Math.round(v * f).toString(16).padStart(2, "0"))
      .join("")}`;
    if (contrastRatio(hex, text) >= ratio) return hex;
  }
  return "#000000";
}
