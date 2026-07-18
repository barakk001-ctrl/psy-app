"use client";

import { Button } from "@/components/ui/button";
import { deleteFutureSessionsAction } from "@/server/actions/sessions";

export function DeleteSeriesButton({ sessionId }: { sessionId: string }) {
  return (
    <form
      action={deleteFutureSessionsAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            "למחוק את הפגישה הזו ואת כל הפגישות העתידיות בסדרה? פגישות שכבר התקיימו לא יימחקו.",
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={sessionId} />
      <Button type="submit" variant="danger" size="sm">
        מחיקת הסדרה מכאן והלאה
      </Button>
    </form>
  );
}
