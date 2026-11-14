import type { ReactNode } from "react";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { ClientStatusMoveButton } from "@/components/clients/client-status-toggle";
import { DeleteClientButton } from "@/components/clients/client-trash";
import { cn } from "@/lib/utils";

/** One client as the list shows it — plain values, so the search can hold the list in the browser. */
export type ClientListItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  sessions: number;
  /** "₪350", ready to show; null when the client has no usual price */
  rate: string | null;
};

/** The small grey label on a search result that comes from another list. */
export function ListTag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-cream-200 px-2 py-0.5 text-[11px] font-normal leading-4 text-ink-muted">
      {children}
    </span>
  );
}

/** A row of the clients list: opens the file, and moves the client between active and inactive. */
export function ClientListRow({ client: c, tag }: { client: ClientListItem; tag?: ReactNode }) {
  const inactive = c.status === "INACTIVE";
  return (
    <li className="flex flex-wrap items-center hover:bg-cream-100/60 transition-colors">
      <Link
        href={`/clients/${c.id}`}
        className="flex-1 min-w-0 flex items-center gap-4 ps-5 pe-2 py-4"
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center font-display text-base shrink-0",
            inactive ? "bg-cream-200 text-ink-muted" : "bg-sage-100 text-sage-700",
          )}
        >
          {c.firstName[0]}
          {c.lastName[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("font-medium", inactive ? "text-ink-muted" : "text-ink")}>
              {c.firstName} {c.lastName}
            </span>
            {tag}
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-muted mt-1">
            {c.phone && (
              <span className="flex items-center gap-1" dir="ltr">
                <Phone className="w-3 h-3" /> {c.phone}
              </span>
            )}
            {c.email && (
              <span className="flex items-center gap-1" dir="ltr">
                <Mail className="w-3 h-3" /> {c.email}
              </span>
            )}
          </div>
        </div>
        <div className="text-left text-xs text-ink-muted shrink-0 hidden sm:block">
          <div>{c.sessions} פגישות</div>
          {c.rate && <div className="mt-0.5">{c.rate}</div>}
        </div>
      </Link>
      <ClientStatusMoveButton clientId={c.id} status={c.status} />
      {inactive && <DeleteClientButton clientId={c.id} variant="row" />}
    </li>
  );
}
