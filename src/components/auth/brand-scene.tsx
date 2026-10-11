// Full-bleed background of the auth pages' brand panel: a deep sage dusk, a
// low warm sun with faint ripples, three soft rolling hills and two young
// sprigs at the edges. Abstract and quiet: it sits behind the large
// "מרפאה אישית" title, so the middle stays dark and empty for the text.
// Scales with "slice" anchored to the bottom: wider panels lose some sky,
// taller ones lose a little of the sides; the hills are always in view.
// Gradient ids are fixed, so render it once per page (the layout does).
// The panel sits on the left with the form to its right, so the drawing is
// mirrored as a whole: the sun and its glow go to the far (left) side, and
// the tall sprig frames the edge next to the form. Coordinates below are
// written for the unmirrored picture.

const LEAF = "M0 0 C7 -8 19 -8 26 0 C19 8 7 8 0 0Z";

export function BrandScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 620"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="brand-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#334331" />
          <stop offset="0.55" stopColor="#3A4B39" />
          <stop offset="0.8" stopColor="#4A5F47" />
        </linearGradient>
        <radialGradient id="brand-glow" cx="590" cy="482" r="330" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#EACDA6" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#EACDA6" stopOpacity="0.08" />
          <stop offset="1" stopColor="#EACDA6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="800" height="620" fill="url(#brand-sky)" />
      <g transform="matrix(-1 0 0 1 800 0)">
      <rect width="800" height="620" fill="url(#brand-glow)" />

      {/* quiet specks of light */}
      <g fill="#FDFBF7">
        <circle cx="128" cy="96" r="1.6" fillOpacity="0.4" />
        <circle cx="262" cy="54" r="1.2" fillOpacity="0.3" />
        <circle cx="684" cy="118" r="1.5" fillOpacity="0.35" />
        <circle cx="742" cy="232" r="1.1" fillOpacity="0.25" />
        <circle cx="70" cy="300" r="1.2" fillOpacity="0.25" />
      </g>

      {/* low sun and its ripples */}
      <g fill="none" stroke="#EACDA6" strokeWidth="1">
        <circle cx="590" cy="482" r="84" strokeOpacity="0.16" />
        <circle cx="590" cy="482" r="116" strokeOpacity="0.1" />
        <circle cx="590" cy="482" r="152" strokeOpacity="0.05" />
      </g>
      <circle cx="590" cy="482" r="54" fill="#EACDA6" fillOpacity="0.9" />

      {/* hills, far to near */}
      <path d="M0 478 C140 440 262 446 402 472 S662 504 800 458 V620 H0 Z" fill="#4E654B" />
      <path d="M0 526 C160 496 302 504 452 530 S700 552 800 516 V620 H0 Z" fill="#42573F" />
      <path d="M0 574 C180 552 360 558 520 580 S722 598 800 572 V620 H0 Z" fill="#2F3D2E" />

      {/* sprig, left edge */}
      <path
        d="M118 604 C110 548 124 482 152 420"
        fill="none"
        stroke="#A8B79C"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g fill="#A8B79C" fillOpacity="0.9">
        <path d={LEAF} transform="translate(114 566) rotate(-160) scale(1.25)" />
        <path d={LEAF} transform="translate(118 520) rotate(-150) scale(1.2)" />
        <path d={LEAF} transform="translate(130 474) rotate(-142) scale(1.05)" />
      </g>
      <g fill="#DCE3D2" fillOpacity="0.85">
        <path d={LEAF} transform="translate(115 544) rotate(-22) scale(1.25)" />
        <path d={LEAF} transform="translate(123 496) rotate(-30) scale(1.15)" />
        <path d={LEAF} transform="translate(150 424) rotate(-64) scale(0.9)" />
      </g>

      {/* smaller sprig, right edge */}
      <path
        d="M702 606 C706 572 698 540 684 506"
        fill="none"
        stroke="#A8B79C"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />
      <g fill="#A8B79C" fillOpacity="0.75">
        <path d={LEAF} transform="translate(704 580) rotate(-24) scale(0.95)" />
        <path d={LEAF} transform="translate(698 548) rotate(-36) scale(0.85)" />
      </g>
      <g fill="#DCE3D2" fillOpacity="0.7">
        <path d={LEAF} transform="translate(703 564) rotate(-156) scale(0.95)" />
        <path d={LEAF} transform="translate(686 510) rotate(-112) scale(0.75)" />
      </g>
      </g>
    </svg>
  );
}
