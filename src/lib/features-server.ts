// Server-side gates for the documents switch (src/lib/features.ts).

import { redirect } from "next/navigation";
import { DOCUMENTS_OFF_ERROR, DOCUMENTS_OFF_PATH, documentsEnabled } from "@/lib/features";

/** Pages under /invoices and /expenses: off → /dashboard, before anything is loaded. */
export function requireDocumentsPage(): void {
  if (!documentsEnabled()) redirect(DOCUMENTS_OFF_PATH);
}

/** API routes: off → 403 with the reason, before anything is loaded. */
export function documentsOffResponse(): Response | null {
  if (documentsEnabled()) return null;
  return new Response(JSON.stringify({ error: DOCUMENTS_OFF_ERROR }), {
    status: 403,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
