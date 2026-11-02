"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Shows an expense's PDF above its form. Nothing the server sends may be framed
 * (frame-ancestors 'none'), and that stays true: the file is fetched through
 * the owner-checked route and shown from memory.
 */
export function ExpensePdfView({ src, title }: { src: string; title: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    let made: string | null = null;
    fetch(src, { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then((blob) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [src]);

  if (failed) {
    return <p className="p-5 text-sm text-ink-muted">לא הצלחנו להציג את הקובץ כאן. פותחים אותו ב״הורדה״.</p>;
  }
  if (!url) {
    return (
      <div className="h-40 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-sage-600 animate-spin" />
      </div>
    );
  }
  return <iframe src={url} title={title} className="w-full h-[60dvh] bg-cream-100" />;
}
