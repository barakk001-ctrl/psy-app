"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** What she sees once morning has issued the document. Closing returns to the list. */
export function IssueSuccess({
  label,
  number,
  url,
  emails,
}: {
  label: string;
  number: string | null;
  /** morning's link to the document, when it gave one */
  url: string | null;
  emails: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sage-100 bg-sage-50 px-4 py-4 space-y-3">
      <div className="flex items-start gap-2 text-sage-700">
        <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">
            המסמך הופק ב-morning: {label}
            {number ? ` ${number}` : ""}
          </p>
          {emails && <p className="text-sm mt-0.5">morning שולח את המסמך אל {emails}.</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {url && (
          <>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" variant="secondary">
                <ExternalLink className="w-4 h-4" /> צפייה והורדה
              </Button>
            </a>
            <Button type="button" size="sm" variant="secondary" onClick={copy}>
              <Copy className="w-4 h-4" /> {copied ? "הועתק ✓" : "העתקת קישור"}
            </Button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${label}${number ? ` ${number}` : ""}: ${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button type="button" size="sm" variant="secondary">
                <MessageCircle className="w-4 h-4" /> שיתוף בוואטסאפ
              </Button>
            </a>
          </>
        )}
        <Link href="/invoices">
          <Button type="button" size="sm">
            סגירה
          </Button>
        </Link>
      </div>
    </div>
  );
}
