import { cn } from "@/lib/utils";

// The app's mark: a soft-gold arched doorway (a calm room) with a young sprig
// growing inside it, on a sage tile. Used in the signed-in header, on every
// auth page, and (rendered to PNG at the same proportions) as the favicon and
// the home-screen icons in public/ (favicon.ico, icons/*.png): if the drawing
// changes, re-render those too. The tile's gradient is CSS, not an SVG
// gradient, so the SVG holds no ids and any number of copies (including
// ones inside display:none panels) render safely.
//
// Drawn on a 64-unit grid; strokes are sized to stay crisp from 24 to 64 px.

export const LOGO_TILE_GRADIENT = "linear-gradient(135deg, #8AA68E 0%, #4C6955 100%)";
export const LOGO_GOLD = "#DCC08A";
export const LOGO_CREAM = "#FDFBF7";

const LEAF = "M0 0C2.6-3.2 6.8-3.2 9.4 0 6.8 3.2 2.6 3.2 0 0Z";
const LEAF_SM = "M0 0C2.2-2.7 5.8-2.7 8 0 5.8 2.7 2.2 2.7 0 0Z";
const LEAF_XS = "M0 0C2-2.4 5-2.4 7 0 5 2.4 2 2.4 0 0Z";

/** Just the drawing (arch + sprig), for a tile or any sage background. */
export function LogoGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <g fill="none" stroke={LOGO_GOLD} strokeWidth="2.4" strokeLinecap="round">
        <path d="M19 49V29a13 13 0 0 1 26 0v20" />
        <path d="M15 49h34" />
      </g>
      <path
        d="M32 49c-.8-6 .2-11 3-16.5"
        fill="none"
        stroke={LOGO_CREAM}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g fill={LOGO_CREAM}>
        <path d={LEAF} transform="translate(31.6 44.5) rotate(-155)" />
        <path d={LEAF} transform="translate(32.1 40.5) rotate(-28)" />
        <path d={LEAF_SM} transform="translate(33.2 36.6) rotate(-148)" />
        <path d={LEAF_XS} transform="translate(34.6 33) rotate(-62)" />
      </g>
    </svg>
  );
}

/** The mark on its rounded sage tile. `size` in px. */
export function LogoMark({
  size = 32,
  className,
  label,
}: {
  size?: number;
  className?: string;
  /** Accessible name; omit when the wordmark sits right next to it. */
  label?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("relative inline-flex shrink-0 overflow-hidden", className)}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        background: LOGO_TILE_GRADIENT,
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.18), 0 2px 8px rgba(76,105,85,0.22), 0 6px 18px rgba(76,105,85,0.14)",
      }}
    >
      <LogoGlyph className="w-full h-full" />
    </span>
  );
}

/** "מרפאה אישית" set as the wordmark: "מרפאה" bold, "אישית" lighter in sage
 *  (or soft gold on a dark background). */
export function Wordmark({
  className,
  tone = "light",
}: {
  className?: string;
  /** light = on cream (ink + sage), dark = on sage/photo (cream + gold) */
  tone?: "light" | "dark";
}) {
  return (
    <span className={cn("font-display font-bold tracking-tight leading-none whitespace-nowrap", className)}>
      <span className={tone === "dark" ? "text-cream-50" : "text-ink"}>מרפאה</span>{" "}
      <span className={cn("font-medium", tone === "dark" ? "text-gold-200" : "text-sage-600")}>אישית</span>
    </span>
  );
}
