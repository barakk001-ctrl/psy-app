// Calm therapy-room scene in the brand palette: armchair, side table,
// plant and a sunny window. Pure geometric SVG — crisp at any size.
export function TherapyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 340"
      className={className}
      role="img"
      aria-label="איור של חדר טיפולים רגוע"
    >
      {/* soft backdrop */}
      <ellipse cx="240" cy="180" rx="212" ry="140" fill="#FAF7F1" />
      <ellipse cx="240" cy="180" rx="212" ry="140" fill="none" stroke="#EDE7DA" strokeWidth="2" />

      {/* window */}
      <rect x="252" y="56" width="140" height="106" rx="10" fill="#FFFFFF" stroke="#E8E2D5" strokeWidth="3" />
      <line x1="322" y1="60" x2="322" y2="158" stroke="#E8E2D5" strokeWidth="3" />
      <line x1="256" y1="109" x2="388" y2="109" stroke="#E8E2D5" strokeWidth="3" />
      <circle cx="292" cy="86" r="13" fill="#EACDA6" />
      <path d="M330 148 q14 -18 28 0" fill="none" stroke="#DCE3D2" strokeWidth="4" strokeLinecap="round" />
      <path d="M350 148 q12 -14 24 0" fill="none" stroke="#DCE3D2" strokeWidth="4" strokeLinecap="round" />

      {/* rug */}
      <ellipse cx="225" cy="272" rx="150" ry="16" fill="#EDE7DA" />
      <ellipse cx="225" cy="272" rx="108" ry="10" fill="#F5F0E6" />

      {/* armchair */}
      <rect x="132" y="140" width="96" height="98" rx="26" fill="#4A6048" />
      <rect x="142" y="196" width="76" height="32" rx="13" fill="#DCE3D2" />
      <rect x="120" y="166" width="24" height="66" rx="12" fill="#3A4B39" />
      <rect x="216" y="166" width="24" height="66" rx="12" fill="#3A4B39" />
      <rect x="138" y="234" width="10" height="18" rx="4" fill="#3A4B39" />
      <rect x="212" y="234" width="10" height="18" rx="4" fill="#3A4B39" />

      {/* side table with mug */}
      <ellipse cx="292" cy="212" rx="36" ry="9" fill="#C89B7B" />
      <rect x="288" y="214" width="8" height="46" rx="3" fill="#9C7B5E" />
      <rect x="278" y="192" width="16" height="16" rx="4" fill="#B5654A" />
      <path d="M294 196 q8 4 0 9" fill="none" stroke="#B5654A" strokeWidth="3" />
      <path d="M282 186 q2 -6 6 -8 M288 186 q1 -5 4 -7" stroke="#9A8E80" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* plant */}
      <path d="M338 244 h40 l-6 38 h-28 z" fill="#B5654A" />
      <path d="M358 244 v-30" stroke="#4A6048" strokeWidth="4" strokeLinecap="round" />
      <path d="M358 226 q-18 -8 -24 -26" stroke="#4A6048" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M358 222 q16 -10 20 -30" stroke="#4A6048" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="330" cy="196" rx="12" ry="20" fill="#5C7559" transform="rotate(-32 330 196)" />
      <ellipse cx="382" cy="188" rx="12" ry="20" fill="#A8B79C" transform="rotate(28 382 188)" />
      <ellipse cx="358" cy="204" rx="11" ry="19" fill="#5C7559" />

      {/* floating calm dots */}
      <circle cx="112" cy="104" r="4" fill="#DCE3D2" />
      <circle cx="92" cy="132" r="3" fill="#EACDA6" />
      <circle cx="404" cy="220" r="4" fill="#DCE3D2" />
    </svg>
  );
}
