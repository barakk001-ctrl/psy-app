import { documentsOffResponse } from "@/lib/features-server";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { clinicDay } from "@/lib/billing-doc-data";
import { loadFilteredDocuments } from "@/lib/income-doc-rows";
import { parseDocListFilters } from "@/lib/income-doc-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The income documents list for the filters on /invoices, so a change shows in
// place: the same query as the page, scoped by the session user. Read-only, so
// it stays open for an expired account, like the page.
export async function GET(req: Request) {
  // Hidden until documents can be issued (src/lib/features.ts)
  const off = documentsOffResponse();
  if (off) return off;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const filters = parseDocListFilters(Object.fromEntries(new URL(req.url).searchParams));
  const data = await loadFilteredDocuments(userId, filters, clinicDay(new Date()));
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
