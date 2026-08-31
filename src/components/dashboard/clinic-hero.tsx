/**
 * Warm clinic-room illustration for the dashboard hero — armchair, plant and
 * a sunny window in the app's sage/cream/terracotta palette. Pure inline SVG
 * so it ships with the page and inherits no external assets.
 */
export function ClinicHero({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 440 280"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      {/* rug */}
      <ellipse cx="235" cy="243" rx="175" ry="24" fill="#F2EDE2" />
      <ellipse cx="235" cy="243" rx="130" ry="17" fill="#E8E2D5" opacity="0.6" />

      {/* window with morning sun */}
      <rect x="42" y="28" width="150" height="122" rx="12" fill="#F1F4ED" stroke="#D4CCB9" strokeWidth="6" />
      <line x1="117" y1="34" x2="117" y2="144" stroke="#D4CCB9" strokeWidth="5" />
      <line x1="48" y1="89" x2="186" y2="89" stroke="#D4CCB9" strokeWidth="5" />
      <circle cx="90" cy="66" r="17" fill="#E3B187" />
      <circle cx="90" cy="66" r="24" fill="#E3B187" opacity="0.25" />

      {/* framed leaf print on the wall */}
      <rect x="252" y="42" width="52" height="64" rx="6" fill="#FAF7F1" stroke="#D4CCB9" strokeWidth="4" />
      <path d="M278 92 C270 78 272 64 278 54 C284 64 286 78 278 92 Z" fill="#A8B79C" />

      {/* armchair */}
      <rect x="248" y="122" width="118" height="74" rx="26" fill="#5C7559" />
      <rect x="258" y="132" width="98" height="46" rx="18" fill="#6E8A6B" />
      <rect x="236" y="158" width="142" height="52" rx="22" fill="#4A6048" />
      <circle cx="247" cy="176" r="17" fill="#5C7559" />
      <circle cx="367" cy="176" r="17" fill="#5C7559" />
      {/* cushion */}
      <rect x="270" y="150" width="40" height="30" rx="12" fill="#B5654A" transform="rotate(-8 290 165)" />
      {/* legs */}
      <rect x="252" y="208" width="9" height="18" rx="4" fill="#9A8E80" />
      <rect x="352" y="208" width="9" height="18" rx="4" fill="#9A8E80" />

      {/* potted plant */}
      <path d="M136 196 L176 196 L169 236 L143 236 Z" fill="#B5654A" />
      <rect x="132" y="190" width="48" height="10" rx="5" fill="#9A553D" />
      <path d="M156 190 C156 168 150 152 134 140" stroke="#4A6048" strokeWidth="4" strokeLinecap="round" />
      <path d="M156 190 C156 164 162 148 180 138" stroke="#4A6048" strokeWidth="4" strokeLinecap="round" />
      <path d="M156 190 C155 170 156 154 156 142" stroke="#4A6048" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="130" cy="136" rx="13" ry="20" fill="#5C7559" transform="rotate(-28 130 136)" />
      <ellipse cx="184" cy="134" rx="13" ry="20" fill="#A8B79C" transform="rotate(26 184 134)" />
      <ellipse cx="156" cy="126" rx="13" ry="22" fill="#6E8A6B" />

      {/* side table with a warm cup */}
      <rect x="60" y="196" width="56" height="7" rx="3.5" fill="#9A8E80" />
      <rect x="84" y="203" width="8" height="30" rx="4" fill="#9A8E80" />
      <path d="M76 188 h16 a2 2 0 0 1 2 2 v3 a8 8 0 0 1 -8 8 h-4 a8 8 0 0 1 -8 -8 v-3 a2 2 0 0 1 2 -2 Z" fill="#B5654A" />
      <path d="M77 184 q2 -5 0 -9 M85 184 q2 -5 0 -9" stroke="#D4CCB9" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
