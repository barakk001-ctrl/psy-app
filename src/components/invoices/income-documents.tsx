"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IncomeDocFilters } from "@/components/invoices/income-doc-filters";
import { DocumentList } from "@/components/invoices/document-list";
import { ViewTabs } from "@/components/ui/view-tabs";
import { docListHref, parseDocListFilters, type DocListFilters } from "@/lib/income-doc-list";
import type { DocMonths } from "@/lib/income-doc-rows";
import { cn } from "@/lib/utils";

/** A slow answer counts as a failed one: the reader is told, never left waiting. */
const REQUEST_TIMEOUT_MS = 15_000;

const documentsHref = (f: DocListFilters) => docListHref({ ...f, view: "documents" });

/**
 * The tabs, filters and lists of /invoices. A filter updates the list in place
 * through a plain fetch of /api/invoices/documents, not the router, which was
 * seen to drop navigations silently. What's shown always agrees: the URL and
 * the list change together, only once the answer is in. If it fails, the
 * filters go back to what the list shows and an error offers to try again.
 */
export function IncomeDocuments({
  filters: serverFilters,
  documents: serverDocuments,
  drafts,
  documentCount,
  draftCount,
}: {
  filters: DocListFilters;
  documents: DocMonths;
  drafts: DocMonths;
  /** Everything in each tab, whatever the filters */
  documentCount: number;
  draftCount: number;
}) {
  const [documents, setDocuments] = useState(serverDocuments);
  // `applied` is what the list shows, `chosen` what the filters show meanwhile
  const [applied, setApplied] = useState(serverFilters);
  const [chosen, setChosen] = useState(serverFilters);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<DocListFilters | null>(null);
  const appliedRef = useRef(serverFilters);
  const latest = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  const apply = useCallback(async (next: DocListFilters) => {
    const ticket = ++latest.current;
    setChosen(next);
    setBusy(true);
    setFailed(null);
    // A shorter list mustn't pull the page out from under the reader
    if (box.current) box.current.style.minHeight = `${box.current.offsetHeight}px`;
    const href = documentsHref(next);
    const query = href.includes("?") ? href.slice(href.indexOf("?")) : "";
    const stop = new AbortController();
    const timer = window.setTimeout(() => stop.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`/api/invoices/documents${query}`, {
        credentials: "same-origin",
        signal: stop.signal,
      });
      if (res.status === 401) {
        // Signed out meanwhile: the page itself takes it from here
        window.location.assign(href);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as DocMonths;
      if (ticket !== latest.current) return; // a newer choice is on its way
      appliedRef.current = next;
      setApplied(next);
      setDocuments(data);
      setBusy(false);
      window.history.replaceState(null, "", href);
    } catch {
      if (ticket !== latest.current) return;
      setChosen(appliedRef.current);
      setBusy(false);
      setFailed(next);
    } finally {
      window.clearTimeout(timer);
    }
  }, []);

  // A new render from the server (after an action) brings fresh rows
  useEffect(() => {
    latest.current++;
    appliedRef.current = serverFilters;
    setApplied(serverFilters);
    setChosen(serverFilters);
    setDocuments(serverDocuments);
    setBusy(false);
  }, [serverFilters, serverDocuments]);

  // Coming back can restore a page older than its address: the address wins
  useEffect(() => {
    const fromUrl = parseDocListFilters(Object.fromEntries(new URLSearchParams(window.location.search)));
    if (documentsHref(fromUrl) !== documentsHref(appliedRef.current)) void apply(fromUrl);
  }, [apply]);

  return (
    <ViewTabs
      active={serverFilters.view}
      tabs={[
        {
          key: "documents",
          label: `מסמכי הכנסות (${documentCount})`,
          href: docListHref({ ...applied, view: "documents" }),
          panel: (
            <>
              <div className="mt-3">
                <IncomeDocFilters
                  filters={chosen}
                  onChange={(patch) => void apply({ ...chosen, ...patch })}
                  onDates={(dates) => setChosen({ ...chosen, ...dates })}
                />
              </div>
              <p role="status" className="text-xs text-ink-muted min-h-4 !mt-2">
                {busy ? "מעדכן…" : ""}
              </p>
              {failed && (
                <div
                  role="alert"
                  className="!mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-4 py-2 text-sm text-terracotta-600"
                >
                  <span>לא הצלחנו לעדכן את הרשימה. מוצגת הרשימה הקודמת.</span>
                  <button type="button" onClick={() => void apply(failed)} className="font-medium underline">
                    ניסיון נוסף
                  </button>
                </div>
              )}
              <div
                ref={box}
                aria-busy={busy}
                className={cn("space-y-6 !mt-2 transition-opacity", busy && "opacity-60")}
              >
                <DocumentList data={documents} drafts={false} anyDocuments={documentCount > 0} />
              </div>
            </>
          ),
        },
        {
          key: "drafts",
          label: `טיוטות מסמכי הכנסות (${draftCount})`,
          href: docListHref({ ...applied, view: "drafts" }),
          panel: (
            <div className="mt-3 space-y-6">
              <DocumentList data={drafts} drafts anyDocuments={documentCount > 0} />
            </div>
          ),
        },
      ]}
    />
  );
}
