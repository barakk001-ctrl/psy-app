"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSessionAction } from "@/server/actions/sessions";

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  return (
    <form
      action={deleteSessionAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "למחוק את הפגישה לצמיתות? גם הסיכום שלה יימחק ולא יופיע ברצף.\n\nאם רוצים לשמור את הפגישה ברשומה — השתמשו ב״ביטול״ במקום.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={sessionId} />
      <Button type="submit" size="sm" variant="ghost" className="text-terracotta-600 hover:bg-terracotta-500/10">
        <Trash2 className="w-4 h-4" />
        מחיקה
      </Button>
    </form>
  );
}
