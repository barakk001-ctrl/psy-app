export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel — visible on lg+ */}
      <aside className="hidden lg:flex flex-col justify-between p-10 bg-sage-700 text-cream-50 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            viewBox="0 0 400 400"
            fill="none"
            aria-hidden
          >
            <circle cx="120" cy="100" r="2" fill="currentColor" />
            <circle cx="280" cy="180" r="2" fill="currentColor" />
            <circle cx="200" cy="260" r="2" fill="currentColor" />
            <circle cx="340" cy="320" r="2" fill="currentColor" />
            <circle cx="80" cy="340" r="2" fill="currentColor" />
            <path
              d="M120 100 L280 180 L200 260 L80 340"
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="2 4"
            />
          </svg>
        </div>
        <div>
          <span className="font-display text-2xl">מרפאה</span>
        </div>
        <div className="relative space-y-6 max-w-sm">
          <p className="font-display text-3xl leading-snug">
            מערכת רגועה אחת לכל מה שהקליניקה שלך צריכה.
          </p>
          <p className="text-sm text-sage-50/80 leading-relaxed">
            לקוחות, פגישות, סיכומים, חשבוניות ותשלומים — במקום אחד, בעברית, עם
            פרטיות שמתאימה למידע רפואי.
          </p>
        </div>
        <div className="text-xs text-sage-50/60">
          הסיכומים הקליניים מוצפנים ברמת היישום (AES-256-GCM)
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
