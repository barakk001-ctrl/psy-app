import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/color-contrast";
import {
  COLOR_THEMES,
  DEFAULT_THEME_ID,
  SHADES,
  channels,
  cleanColorTheme,
  colorTheme,
  themeAccent,
  themeCss,
  themeVars,
} from "@/lib/color-themes";

// The colours a set is drawn against, which no set changes (tailwind.config.ts)
const WHITE = "#FFFFFF";
const CREAM_50 = "#FDFBF7";
const CREAM_100 = "#FAF7F1";
const CREAM_200 = "#F2EDE2";
const INK = "#1A1714";
const INK_MUTED = "#6B5F52";
const TERRACOTTA = "#B5654A";

const root = join(__dirname, "..", "..", "..");

describe("the colour sets", () => {
  it("are six ready-made sets with their own names, the default first", () => {
    expect(COLOR_THEMES.length).toBe(6);
    expect(COLOR_THEMES[0].id).toBe(DEFAULT_THEME_ID);
    expect(new Set(COLOR_THEMES.map((t) => t.id)).size).toBe(COLOR_THEMES.length);
    expect(new Set(COLOR_THEMES.map((t) => t.label)).size).toBe(COLOR_THEMES.length);
    for (const t of COLOR_THEMES) {
      expect(t.label).toMatch(/[֐-׿]/);
      for (const s of SHADES) expect(t.scale[s]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("have a main shade of their own, none of them the colour of a warning", () => {
    const mains = COLOR_THEMES.map((t) => t.scale[500]);
    expect(new Set(mains).size).toBe(mains.length);
    expect(mains).not.toContain(TERRACOTTA);
  });
});

// Every way the app writes with or on the accent scale. WCAG AA for normal
// text is 4.5:1; the default set passes each of these, and so must every other.
describe.each(COLOR_THEMES.map((t) => [t.label, t] as const))("text contrast in the set %s", (_label, t) => {
  const s = t.scale;

  it("light text on the filled shades: buttons, chips, the active tab, calendar pills", () => {
    for (const bg of [s[500], s[600], s[700]]) {
      expect(contrastRatio(CREAM_50, bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(WHITE, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the set's text shades on every surface they are written on", () => {
    for (const text of [s[600], s[700]]) {
      for (const bg of [WHITE, CREAM_50, CREAM_100, CREAM_200, s[50], s[100]]) {
        expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
    // the main shade is text in a couple of places, on white and cream only
    for (const bg of [WHITE, CREAM_50, CREAM_100]) {
      expect(contrastRatio(s[500], bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the app's own text on the set's tinted backgrounds", () => {
    for (const bg of [s[50], s[100]]) {
      expect(contrastRatio(INK, bg)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(INK_MUTED, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(INK, s[300])).toBeGreaterThanOrEqual(7);
  });

  it("runs from light to dark, as the default does", () => {
    const light = SHADES.map((shade) => contrastRatio(s[shade], "#000000"));
    expect([...light].sort((a, b) => b - a)).toEqual(light);
  });

  it("is no harder to read than the default set", () => {
    const base = COLOR_THEMES[0].scale;
    expect(contrastRatio(CREAM_50, s[500])).toBeGreaterThanOrEqual(contrastRatio(CREAM_50, base[500]) - 0.01);
    expect(contrastRatio(s[600], s[100])).toBeGreaterThanOrEqual(contrastRatio(base[600], base[100]) - 0.01);
  });
});

describe("reading the stored set", () => {
  it("keeps a known set, and reads anything else as the default", () => {
    expect(cleanColorTheme("ocean")).toBe("ocean");
    expect(cleanColorTheme("sage")).toBeNull();
    expect(cleanColorTheme(null)).toBeNull();
    expect(cleanColorTheme(undefined)).toBeNull();
    expect(cleanColorTheme("")).toBeNull();
    expect(cleanColorTheme("OCEAN")).toBeNull();
    expect(cleanColorTheme("#123456")).toBeNull();
    expect(cleanColorTheme(["ocean"])).toBeNull();
    expect(colorTheme("nothing").id).toBe("sage");
    expect(colorTheme("mauve").label).toBe("ורוד עתיק");
    expect(themeAccent(null)).toBe("#5C7559");
    expect(themeAccent("ocean")).toBe("#4E7191");
  });
});

describe("the set on the page", () => {
  it("writes a colour as the channels rgb() takes", () => {
    expect(channels("#5C7559")).toBe("92 117 89");
    expect(channels("#FFFFFF")).toBe("255 255 255");
    expect(channels("#000000")).toBe("0 0 0");
  });

  it("adds nothing for the default set, or for a value that is not a set", () => {
    expect(themeCss(null)).toBeNull();
    expect(themeCss("sage")).toBeNull();
    expect(themeCss("</style><script>alert(1)</script>")).toBeNull();
    expect(themeCss({ id: "ocean" })).toBeNull();
  });

  it("overrides the six variables, and only with numbers", () => {
    for (const t of COLOR_THEMES.slice(1)) {
      const css = themeCss(t.id)!;
      expect(css).toMatch(/^:root\{(--sage-(50|100|300|500|600|700):\d{1,3} \d{1,3} \d{1,3};?){6}\}$/);
      expect(themeVars(t.id).map(([name]) => name)).toEqual(SHADES.map((s) => `--sage-${s}`));
    }
    expect(themeCss("ocean")).toContain("--sage-500:78 113 145");
  });

  it("the stylesheet's own variables are the default set", () => {
    const css = readFileSync(join(root, "src", "app", "globals.css"), "utf8");
    for (const [name, value] of themeVars(DEFAULT_THEME_ID)) {
      expect(css).toContain(`${name}: ${value};`);
    }
  });

  it("tailwind draws the whole accent scale from those variables", () => {
    const config = readFileSync(join(root, "tailwind.config.ts"), "utf8");
    for (const s of SHADES) {
      expect(config).toContain(`${s}: "rgb(var(--sage-${s}) / <alpha-value>)"`);
    }
  });
});
