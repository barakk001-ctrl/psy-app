import { Button } from "@/components/ui/button";
import { updateSessionStatusAction } from "@/server/actions/sessions";

export function SessionStatusActions({
  sessionId,
  currentStatus,
}: {
  sessionId: string;
  currentStatus: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {currentStatus !== "COMPLETED" && (
        <form action={updateSessionStatusAction}>
          <input type="hidden" name="id" value={sessionId} />
          <input type="hidden" name="status" value="COMPLETED" />
          <Button type="submit" size="sm" variant="secondary">
            סמן כהתקיימה
          </Button>
        </form>
      )}
      {currentStatus !== "NO_SHOW" && currentStatus !== "COMPLETED" && (
        <form action={updateSessionStatusAction}>
          <input type="hidden" name="id" value={sessionId} />
          <input type="hidden" name="status" value="NO_SHOW" />
          <Button type="submit" size="sm" variant="ghost">
            לא הופיע/ה
          </Button>
        </form>
      )}
      {currentStatus !== "CANCELLED" && (
        <form action={updateSessionStatusAction}>
          <input type="hidden" name="id" value={sessionId} />
          <input type="hidden" name="status" value="CANCELLED" />
          <Button type="submit" size="sm" variant="ghost">
            ביטול
          </Button>
        </form>
      )}
      {currentStatus !== "SCHEDULED" && (
        <form action={updateSessionStatusAction}>
          <input type="hidden" name="id" value={sessionId} />
          <input type="hidden" name="status" value="SCHEDULED" />
          <Button type="submit" size="sm" variant="ghost">
            החזר למתוכננת
          </Button>
        </form>
      )}
    </div>
  );
}
