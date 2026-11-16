"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { Check, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BrandMark } from "@/components/layout/brand-mark";
import { LOGO_MAX_CHARS, logoThumbnailSize } from "@/lib/branding";
import { updateBrandingAction, type SettingsFormState } from "@/server/actions/settings";

/** Shrinks any picked image to a small thumbnail, as a data: URL: the whole
 *  picture in its own proportions, nothing cut off (the dashboard shows it
 *  whole; the small square spots show its centre). A phone photo is several
 *  MB; the header needs a few KB. */
async function toThumbnail(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = logoThumbnailSize(bitmap.width, bitmap.height);
  const draw = (background?: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas;
  };
  // PNG keeps a transparent logo transparent; photos are smaller as JPEG
  const png = file.type === "image/png" ? draw().toDataURL("image/png") : null;
  if (png && png.length < 150_000) {
    bitmap.close();
    return png;
  }
  // JPEG has no transparency: see-through parts go white, not black
  const flat = draw("#FFFFFF");
  bitmap.close();
  const jpeg = flat.toDataURL("image/jpeg", 0.85);
  return jpeg.length <= LOGO_MAX_CHARS ? jpeg : flat.toDataURL("image/jpeg", 0.6);
}

export function BrandingCard({
  initial,
  documents = true,
  formId,
  onSaved,
  hideSave = false,
}: {
  initial: { brandName: string | null; logoUrl: string | null; logoOnDocuments?: boolean };
  /** income/expense documents shown (src/lib/features.ts); hidden → no "logo on documents" choice */
  documents?: boolean;
  /** the setup wizard submits this form from its own "הבא" button */
  formId?: string;
  onSaved?: () => void;
  hideSave?: boolean;
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
  const [onDocuments, setOnDocuments] = useState(initial.logoOnDocuments ?? false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state?.saved) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per save
  }, [state]);

  return (
    <form
      id={formId}
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
            שם העסק ותמונה או לוגו שיופיעו בראש האפליקציה, ליד ״מרפאה אישית״
            {documents ? ", ואם רוצים גם בראש מסמכי ההכנסות." : "."}
          </p>

          <div className="rounded-2xl border border-cream-200 bg-white/60 px-4 py-3">
            <p className="text-xs text-ink-subtle mb-2">תצוגה מקדימה</p>
            <div className="pointer-events-none">
              <BrandMark branding={{ brandName, logoUrl: logo }} />
            </div>
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
              התמונה מוקטנת אוטומטית ונשמרת בשלמותה. בדף הבית היא מוצגת כולה,
              ובמקומות הקטנים (כמו בתצוגה המקדימה כאן) מוצג הריבוע שבמרכזה.
            </p>
            {readError && <p className="text-xs text-terracotta-600 mt-1">{readError}</p>}
          </div>

          {!documents ? (
            // The choice is hidden with the documents; send what is stored so a save keeps it
            onDocuments && <input type="hidden" name="logoOnDocuments" value="on" />
          ) : (
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="logoOnDocuments"
                checked={onDocuments}
                onChange={(e) => setOnDocuments(e.target.checked)}
                className="mt-0.5 w-5 h-5 shrink-0 accent-sage-600"
                aria-describedby="logo-on-documents-hint"
              />
              <span className="text-sm text-ink">להציג את הלוגו גם בראש מסמכי ההכנסות</span>
            </label>
            <p id="logo-on-documents-hint" className="text-xs text-ink-muted mt-1 ms-8">
              בתצוגה המקדימה של המסמכים ובקובצי ה-PDF של הטיוטות.
              {onDocuments && !logo && " עדיין לא נבחרה תמונה."}
            </p>
          </div>
          )}
        </CardContent>
      </Card>

      {state?.error && (
        <div role="alert" className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
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
        {!hideSave && (
          <Button type="submit" disabled={pending}>
            {pending ? "שומר…" : "שמירת מיתוג"}
          </Button>
        )}
      </div>
    </form>
  );
}
