"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Tags } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addMeetingTypeAction,
  deleteMeetingTypeAction,
} from "@/server/actions/meeting-types";

export function MeetingTypesCard({
  types,
}: {
  types: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-sage-600" />
          סוגי מפגשים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-muted leading-relaxed">
          הסוגים שמוגדרים כאן יופיעו לבחירה בפתיחת לקוח חדש ובקביעת פגישה ביומן.
        </p>

        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-sage-100 bg-sage-50 ps-3 pe-1.5 py-1 text-sm text-sage-700"
            >
              {t.name}
              <form
                action={async (fd) => {
                  await deleteMeetingTypeAction(fd);
                  router.refresh();
                }}
              >
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  aria-label={`הסרת ${t.name}`}
                  className="w-5 h-5 grid place-items-center rounded-full text-sage-600 hover:bg-sage-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            </span>
          ))}
          {types.length === 0 && (
            <p className="text-sm text-ink-subtle">
              אין סוגים מוגדרים — בינתיים מוצגת רשימת ברירת המחדל.
            </p>
          )}
        </div>

        <form
          ref={formRef}
          action={async (fd) => {
            await addMeetingTypeAction(fd);
            formRef.current?.reset();
            router.refresh();
          }}
          className="flex items-center gap-2"
        >
          <Input
            name="name"
            placeholder="סוג מפגש חדש… (למשל: טיפול זוגי)"
            maxLength={60}
            required
            className="h-10"
          />
          <button
            type="submit"
            aria-label="הוספת סוג מפגש"
            className="shrink-0 h-10 w-10 rounded-xl bg-sage-600 text-cream-50 grid place-items-center hover:bg-sage-700 transition-colors active:scale-95"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        <p className="text-xs text-ink-subtle">
          הסרת סוג לא משנה פגישות ולקוחות קיימים — הם שומרים את הסוג שנבחר להם.
        </p>
      </CardContent>
    </Card>
  );
}
