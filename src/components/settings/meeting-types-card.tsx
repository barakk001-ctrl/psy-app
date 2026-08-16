"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Tags, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MEETING_TYPE_COLORS } from "@/lib/meeting-type-colors";
import {
  addMeetingTypeAction,
  deleteMeetingTypeAction,
  setMeetingTypeColorAction,
} from "@/server/actions/meeting-types";

const DEFAULT_COLOR = MEETING_TYPE_COLORS[0];

export function MeetingTypesCard({
  types,
}: {
  types: { id: string; name: string; color: string | null }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const editing = types.find((t) => t.id === editingId) ?? null;

  const pickColor = (id: string, color: string) => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("color", color);
    startTransition(async () => {
      await setMeetingTypeColorAction(fd);
      router.refresh();
    });
    setEditingId(null);
  };

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
          לחיצה על העיגול הצבעוני בוחרת צבע לפגישות מהסוג הזה ביומן.
        </p>

        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-sage-100 bg-sage-50 ps-1.5 pe-1.5 py-1 text-sm text-sage-700"
            >
              <button
                type="button"
                aria-label={`בחירת צבע עבור ${t.name}`}
                title="בחירת צבע ליומן"
                onClick={() => setEditingId(editingId === t.id ? null : t.id)}
                className="w-5 h-5 rounded-full border-2 border-white shadow-sm shrink-0 transition-transform hover:scale-110"
                style={{ backgroundColor: t.color ?? DEFAULT_COLOR }}
              />
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

        {editing && (
          <div className="rounded-xl border border-cream-200 bg-cream-50/60 p-3 space-y-2">
            <p className="text-xs text-ink-muted">
              צבע ביומן עבור <b className="text-ink">{editing.name}</b>:
            </p>
            <div className="flex flex-wrap gap-2">
              {MEETING_TYPE_COLORS.map((c) => {
                const selected = (editing.color ?? DEFAULT_COLOR) === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`צבע ${c}`}
                    onClick={() => pickColor(editing.id, c)}
                    className="w-8 h-8 rounded-full grid place-items-center border-2 border-white shadow-sm transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  >
                    {selected && <Check className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
