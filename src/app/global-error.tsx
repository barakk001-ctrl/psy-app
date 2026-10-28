"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

// Last-resort screen when the root layout itself fails. It replaces the whole
// document, so it brings its own <html>/<body> and plain inline styles (the
// app's CSS and fonts may be what failed).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    reportClientError(error);
  }, [error]);

  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FAF7F1",
          color: "#2B2A27",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
          textAlign: "center",
          padding: "16px",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>משהו השתבש</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 20px", color: "#5C5A55" }}>
            אירעה שגיאה בלתי צפויה. אפשר לנסות שוב, ואם הבעיה חוזרת — לסגור את האפליקציה ולפתוח אותה מחדש.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#8A8780", margin: "0 0 20px" }}>קוד שגיאה: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#5E7D67",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "10px 22px",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            נסו שוב
          </button>
        </div>
      </body>
    </html>
  );
}
