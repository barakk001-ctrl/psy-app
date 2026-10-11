// The auth pages' small emblem, shown above the form on phones (where the
// brand panel is hidden): a sage disc holding a low warm sun, two calm hills
// and a young sprig: the same motif as the panel's full-bleed BrandScene.
// Pure geometric SVG, no ids. The two faint ripple rings use currentColor:
// give it a text colour that reads on the background.
export function BrandEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 240"
      className={className}
      role="img"
      aria-label="איור: ענף צעיר צומח מול שמש רכה"
    >
      {/* ripples */}
      <circle cx="120" cy="120" r="104" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1" />
      <circle cx="120" cy="120" r="116" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />

      {/* disc */}
      <circle cx="120" cy="120" r="92" fill="#4A6048" />

      {/* quiet specks of light */}
      <circle cx="80" cy="80" r="1.6" fill="#FDFBF7" fillOpacity="0.55" />
      <circle cx="164" cy="66" r="1.2" fill="#FDFBF7" fillOpacity="0.45" />
      <circle cx="186" cy="98" r="1" fill="#FDFBF7" fillOpacity="0.35" />

      {/* low warm sun with a soft halo */}
      <circle cx="152" cy="126" r="34" fill="#EACDA6" fillOpacity="0.14" />
      <circle cx="152" cy="126" r="22" fill="#EACDA6" fillOpacity="0.92" />

      {/* hills: wave on top, the disc's own arc underneath */}
      <path
        d="M29.8 138 C62 120 96 120 128 131 S184 146 210.2 138 A92 92 0 0 1 29.8 138 Z"
        fill="#5C7559"
      />
      <path
        d="M41.5 168 C78 151 116 152 148 161 S186 172 198.5 168 A92 92 0 0 1 41.5 168 Z"
        fill="#3A4B39"
      />

      {/* sprig */}
      <path
        d="M96 196 C92 165 100 130 112 98"
        fill="none"
        stroke="#DCE3D2"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g fill="#DCE3D2">
        <path d="M0 0 C7 -8 19 -8 26 0 C19 8 7 8 0 0Z" transform="translate(95 172) rotate(-158)" />
        <path d="M0 0 C7 -8 19 -8 26 0 C19 8 7 8 0 0Z" transform="translate(98 147) rotate(-150)" />
        <path d="M0 0 C6 -7 16 -7 22 0 C16 7 6 7 0 0Z" transform="translate(104 122) rotate(-142)" />
      </g>
      <g fill="#F1F4ED">
        <path d="M0 0 C7 -8 19 -8 26 0 C19 8 7 8 0 0Z" transform="translate(96.5 160) rotate(-24)" />
        <path d="M0 0 C7 -8 19 -8 26 0 C19 8 7 8 0 0Z" transform="translate(101 134) rotate(-32)" />
        <path d="M0 0 C5 -6 13 -6 18 0 C13 6 5 6 0 0Z" transform="translate(111 101) rotate(-66)" />
      </g>
    </svg>
  );
}
