"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  archiveClientAction,
  unarchiveClientAction,
} from "@/server/actions/clients";

export function ArchiveButton({
  clientId,
  clientName,
  archived,
}: {
  clientId: string;
  clientName: string;
  archived: boolean;
}) {
  if (archived) {
    return (
      <form action={unarchiveClientAction}>
        <input type="hidden" name="id" value={clientId} />
        <Button type="submit" size="sm" variant="secondary">
          <ArchiveRestore className="w-4 h-4" />
          שחזור
        </Button>
      </form>
    );
  }

  return (
    <form
      action={archiveClientAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `לאחסן את ${clientName}?\n\nהלקוח/ה לא יוצגו ברשימה הראשית. ההיסטוריה (פגישות, סיכומים, חשבוניות) תישמר במלואה ותמיד ניתן יהיה לשחזר.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={clientId} />
      <Button type="submit" size="sm" variant="ghost">
        <Archive className="w-4 h-4" />
        אחסון
      </Button>
    </form>
  );
}
