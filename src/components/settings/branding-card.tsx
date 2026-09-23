"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BrandMark } from "@/components/layout/brand-mark";
import { LOGO_SIZE_PX } from "@/lib/branding";
import { updateBrandingAction, type SettingsFormState } from "@/server/actions/settings";

/** Shrinks any picked image to a centred square thumbnail, as a data: URL.
 *  A phone photo is several MB; the header needs a few KB. */
async function toThumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = LOGO_SIZE_PX;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    LOGO_SIZE_PX,
    LOGO_SIZE_PX,
  );
  bitmap.close();
  // PNG keeps a transparent logo transparent; photos are smaller as JPEG
  const png = canvas.toDataURL("image/png");
  const jpeg = canvas.toDataURL("image/jpeg", 0.85);
  return file.type === "image/png" && png.length < 150_000 ? png : jpeg;
}

export function BrandingCard({
  initial,
}: {
  initial: { brandName: string | null; logoUrl: string | null };
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateBrandingAction,
    null,
  );
  const [brandName, setBrandName] = useState(initial.brandName ?? "");
  const [logo, setLogo] = useState<string | null>(initial.logoUrl);
  // what to send: "" keeps the stored logo, a data: URL replaces it, REMOVE clears it
  const [logoField, setLogoField] = useState("");
  const [readError, setReadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <Card>
        <CardContent className="space-y-5">
          <h2 className="font-display text-xl text-ink">מיתוג</h2>
          <p className="text-xs text-ink-muted">
            שם העסק ותמונה או לוגו שיופיעו בראש האפליקציה, ליד ״מרפאה אישית״.
          </p>

          <div className="rounded-2xl border border-cream-200 bg-white/60 px-4 py-3">
            <p className="text-xs text-ink-subtle mb-2">תצוגה מקדימה</p>
            <BrandMark branding={{ brandName, logoUrl: logo }} />
          </div>

          <div>
            <Label htmlFor="brandName">שם העסק לתצוגה</Label>
            <Input
              id="brandName"
              name="brandName"
              value={brandName}
              maxLength={60}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="למשל: הקליניקה של דנה"
            />
          </div>

          <div>
            <Label>תמונה או לוגו</Label>
            <input type="hidden" name="logo" value={logoField} />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setReadError(null);
                try {
                  const url = await toThumbnail(f);
                  setLogo(url);
                  setLogoField(url);
                } catch {
                  setReadError("לא הצלחנו לקרוא את התמונה — נסו קובץ JPG או PNG");
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="w-4 h-4" />
                {logo ? "החלפת תמונה" : "בחירת תמונה"}
              </Button>
              {logo && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setLogo(null);
                    setLogoField("REMOVE");
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  הסרה
                </Button>
              )}
            </div>
            <p className="text-xs text-ink-muted mt-1">
              התמונה נחתכת לריבוע ומוקטנת אוטומטית.
            </p>
            {readError && <p className="text-xs text-terracotta-600 mt-1">{readError}</p>}
          </div>
        </CardContent>
      </Card>

      {state?.error && (
        <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs">
          {state?.saved && !pending && (
            <span className="inline-flex items-center gap-1 text-sage-600">
              <Check className="w-3.5 h-3.5" />
              נשמר
            </span>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "שומר…" : "שמירת מיתוג"}
        </Button>
      </div>
    </form>
  );
}
