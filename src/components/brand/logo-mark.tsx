import { cn } from "@/lib/utils";

// The app's mark: a miniature of the dashboard's clinic-room illustration
// (components/dashboard/clinic-hero.tsx): window with a morning sun, a small
// leaf print, a potted plant and the green sofa with its coral cushion, on a
// light sage tile with a soft-gold hairline. Below 28 px the scene is too
// busy, so the mark falls back to the sofa alone. Colours are the
// illustration's own, so it reads as "the same picture".
//
// Used in the signed-in header, on every auth page, and (rendered to PNG at
// the same proportions) as the favicon and home-screen icons in public/
// (favicon.ico, icons/*.png): if the drawing changes, re-render those and
// bump the ?v= in app/layout.tsx and app/manifest.ts. The tile's gradient is
// CSS, so the SVG holds no ids and any number of copies render safely.

export const LOGO_TILE_GRADIENT = "linear-gradient(135deg, #F7F9F3 0%, #D9E2CF 100%)";
export const LOGO_TILE_SHADOW =
  "inset 0 0 0 1px rgba(205,174,114,0.55), 0 2px 8px rgba(76,105,85,0.18), 0 6px 18px rgba(76,105,85,0.10)";

/** The sofa alone (small sizes, the 16 px favicon). 64-unit grid. */
export function SofaGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <ellipse cx="32" cy="51" rx="23" ry="3" fill="#E8E2D5" />
      <rect x="14" y="19" width="36" height="22" rx="8" fill="#5C7559" />
      <rect x="17.5" y="22" width="29" height="13" rx="5.5" fill="#6E8A6B" />
      <rect x="9" y="32" width="46" height="15" rx="7" fill="#4A6048" />
      <circle cx="12.5" cy="37.5" r="5.5" fill="#5C7559" />
      <circle cx="51.5" cy="37.5" r="5.5" fill="#5C7559" />
      <rect x="21" y="27" width="13" height="10" rx="3.8" fill="#B5654A" transform="rotate(-8 27.5 32)" />
      <rect x="14" y="46" width="3.2" height="5" rx="1.5" fill="#9A8E80" />
      <rect x="46.8" y="46" width="3.2" height="5" rx="1.5" fill="#9A8E80" />
    </svg>
  );
}

/** The mini clinic scene: window, print, plant and sofa. 64-unit grid. */
export function SceneGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <ellipse cx="34" cy="53" rx="25" ry="2.8" fill="#E8E2D5" />
      {/* window with the morning sun */}
      <rect x="7" y="9" width="19" height="16" rx="2.6" fill="#FAF7F1" stroke="#CFC6B2" strokeWidth="1.8" />
      <path d="M16.5 10v14M8 17h17" stroke="#CFC6B2" strokeWidth="1.5" />
      <circle cx="12.3" cy="13.6" r="2.6" fill="#E3B187" />
      {/* leaf print */}
      <rect x="38" y="9" width="9" height="11" rx="1.6" fill="#FAF7F1" stroke="#CFC6B2" strokeWidth="1.4" />
      <path d="M42.5 17.5c-1.6-2.6-1.4-5 0-6.8 1.4 1.8 1.6 4.2 0 6.8z" fill="#A8B79C" />
      {/* sofa with its cushion */}
      <rect x="28" y="27" width="28" height="17" rx="6.5" fill="#5C7559" />
      <rect x="30.6" y="29.4" width="22.8" height="10" rx="4.4" fill="#6E8A6B" />
      <rect x="24.5" y="36.5" width="35" height="11.5" rx="5.5" fill="#4A6048" />
      <circle cx="27.3" cy="40.7" r="4.2" fill="#5C7559" />
      <circle cx="56.7" cy="40.7" r="4.2" fill="#5C7559" />
      <rect x="32.8" y="32.6" width="10" height="7.6" rx="3" fill="#B5654A" transform="rotate(-8 37.8 36.4)" />
      <rect x="29" y="47.4" width="2.6" height="4.4" rx="1.2" fill="#9A8E80" />
      <rect x="52.4" y="47.4" width="2.6" height="4.4" rx="1.2" fill="#9A8E80" />
      {/* potted plant */}
      <path d="M9.5 43h11l-1.8 9.5h-7.4z" fill="#B5654A" />
      <rect x="8.4" y="41.4" width="13.2" height="3" rx="1.5" fill="#9A553D" />
      <path
        d="M15 41.5c0-5-1.6-8.6-5-11.2M15 41.5c0-5.6 1.6-9 5.4-11.4M15 41.5c-.2-4.6 0-8.2 0-11"
        stroke="#4A6048"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="9.4" cy="29.6" rx="3" ry="4.8" fill="#5C7559" transform="rotate(-28 9.4 29.6)" />
      <ellipse cx="20.8" cy="29.2" rx="3" ry="4.8" fill="#A8B79C" transform="rotate(26 20.8 29.2)" />
      <ellipse cx="15" cy="27.4" rx="3" ry="5.2" fill="#6E8A6B" />
    </svg>
  );
}

/** The mark on its rounded light-sage tile. `size` in px. */
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
  const Glyph = size < 28 ? SofaGlyph : SceneGlyph;
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
        boxShadow: LOGO_TILE_SHADOW,
      }}
    >
      <Glyph className="w-full h-full" />
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
