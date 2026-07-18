"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="font-display text-2xl text-ink">משהו השתבש</h2>
      <p className="max-w-md text-sm text-ink-muted">
        אירעה שגיאה בלתי צפויה. אפשר לנסות שוב, ואם הבעיה חוזרת — לרענן את הדף.
      </p>
      {error.digest ? (
        <p className="text-xs text-ink-subtle">קוד שגיאה: {error.digest}</p>
      ) : null}
      <Button onClick={reset}>נסה שוב</Button>
    </div>
  );
}
