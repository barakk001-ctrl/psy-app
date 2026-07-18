import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-50 text-center">
      <p className="font-display text-6xl text-sage-600">404</p>
      <h1 className="font-display text-2xl text-ink">הדף לא נמצא</h1>
      <p className="max-w-md text-sm text-ink-muted">
        הדף שחיפשת לא קיים או שהועבר למקום אחר.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex h-10 items-center rounded bg-sage-600 px-4 text-sm font-medium text-cream-50 transition-colors hover:bg-sage-700"
      >
        חזרה לסקירה
      </Link>
    </div>
  );
}
