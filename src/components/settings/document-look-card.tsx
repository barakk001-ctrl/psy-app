"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Check, ImagePlus, Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DOC_COLORS,
  DOC_COLOR_KEYS,
  DOC_TEMPLATES,
  DOC_TEMPLATE_HINTS,
  DOC_TEMPLATE_LABELS,
  SIGNATURE_MAX_CHARS,
  SIGNATURE_MAX_HEIGHT,
  SIGNATURE_MAX_WIDTH,
  sampleDocumentDraft,
  type DocColor,
  type DocLook,
  type DocTemplate,
} from "@/lib/document-look";
import type { DocBusiness } from "@/lib/document-business";
import { DocumentPreview } from "@/components/invoices/document-preview";
import { updateDocumentLookAction, type SettingsFormState } from "@/server/actions/settings";

/** Scales a picked signature into a small box, keeping transparency (PNG). */
async function toSignature(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SIGNATURE_MAX_WIDTH / bitmap.width, SIGNATURE_MAX_HEIGHT / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = canvas.toDataURL("image/png");
  if (png.length <= SIGNATURE_MAX_CHARS) return png;
  // A photo of a signature: JPEG on white is far smaller
  const flat = document.createElement("canvas");
  flat.width = canvas.width;
  flat.height = canvas.height;
  const ctx = flat.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, flat.width, flat.height);
  ctx.drawImage(canvas, 0, 0);
  return flat.toDataURL("image/jpeg", 0.85);
}

/**
 * Settings → הגדרות מסמכים → "מראה המסמך": the logo (from מיתוג, not uploaded
 * twice), the signature, the template and the color, with a live preview of
 * a made-up document.
 */
export function DocumentLookCard({
  business,
  look,
  logoUrl,
  logoOnDocuments,
  today,
}: {
  business: DocBusiness;
  look: DocLook;
  /** the logo from מיתוג, whether or not it is shown on documents */
  logoUrl: string | null;
  logoOnDocuments: boolean;
  /** yyyy-mm-dd, for the example */
  today: string;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(updateDocumentLookAction, null);
  const [template, setTemplate] = useState<DocTemplate>(look.template);
  const [color, setColor] = useState<DocColor>(look.color);
  const [signature, setSignature] = useState<string | null>(business.signatureUrl ?? null);
  // "" keeps the stored one, a data: URL replaces it, REMOVE clears it
  const [signatureField, setSignatureField] = useState("");
  const [readError, setReadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-sage-600" />
          מראה המסמך
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-6"
          noValidate
          // By hand, so a refused save keeps the choices (see CLAUDE.md)
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
        >
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-ink">לוגו</h3>
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="הלוגו הנוכחי" className="w-12 h-12 rounded-xl object-cover border border-cream-200" />
              ) : (
                <span className="text-sm text-ink-muted">עדיין לא נבחר לוגו.</span>
              )}
              <p className="text-xs text-ink-muted">
                הלוגו נלקח מ
                <Link href="/settings?tab=business#branding" className="text-sage-600 hover:underline">
                  ״מיתוג״ בהגדרות העסק
                </Link>
                {logoUrl && !logoOnDocuments && ". כדי שיופיע במסמכים מסמנים שם ״להציג את הלוגו גם בראש מסמכי ההכנסות״"}
                .
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium text-ink">חתימה דיגיטלית</h3>
            <p className="text-xs text-ink-muted">
              תמונה של החתימה (מומלץ PNG על רקע שקוף). מופיעה בתחתית המסמכים.
            </p>
            <input type="hidden" name="signature" value={signatureField} />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              aria-label="בחירת תמונת חתימה"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setReadError(null);
                try {
                  const url = await toSignature(f);
                  if (url.length > SIGNATURE_MAX_CHARS) throw new Error("too big");
                  setSignature(url);
                  setSignatureField(url);
                } catch {
                  setReadError("לא הצלחנו לקרוא את התמונה — נסו קובץ PNG או JPG");
                }
              }}
            />
            {signature && (
              <div className="inline-block rounded-xl border border-cream-200 bg-white px-4 py-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signature} alt="החתימה" className="max-h-16 max-w-[220px] object-contain" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="w-4 h-4" />
                {signature ? "החלפת החתימה" : "העלאת חתימה"}
              </Button>
              {signature && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSignature(null);
                    setSignatureField("REMOVE");
                  }}
                >
                  <Trash2 className="w-4 h-4" /> הסרה
                </Button>
              )}
            </div>
            {readError && (
              <p role="alert" className="text-xs text-terracotta-600">
                {readError}
              </p>
            )}
          </section>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink mb-2">תבנית</legend>
            <div className="grid sm:grid-cols-3 gap-2">
              {DOC_TEMPLATES.map((t) => (
                <label
                  key={t}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sage-500",
                    template === t ? "border-sage-500 bg-sage-50" : "border-cream-300 bg-white/70",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium text-ink">
                    <input
                      type="radio"
                      name="docTemplate"
                      value={t}
                      checked={template === t}
                      onChange={() => setTemplate(t)}
                      className="accent-sage-600"
                    />
                    {DOC_TEMPLATE_LABELS[t]}
                  </span>
                  <span className="text-xs text-ink-muted">{DOC_TEMPLATE_HINTS[t]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-ink mb-2">צבע</legend>
            <div className="flex flex-wrap gap-2">
              {DOC_COLOR_KEYS.map((c) => (
                <label
                  key={c}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sage-500",
                    color === c ? "border-ink bg-white" : "border-cream-300 bg-white/70",
                  )}
                >
                  <input
                    type="radio"
                    name="docColor"
                    value={c}
                    checked={color === c}
                    onChange={() => setColor(c)}
                    className="sr-only"
                  />
                  <span aria-hidden className="h-5 w-5 rounded-full" style={{ backgroundColor: DOC_COLORS[c].hex }} />
                  {DOC_COLORS[c].label}
                  {color === c && <Check className="w-4 h-4 text-ink" aria-hidden />}
                </label>
              ))}
            </div>
          </fieldset>

          <section className="space-y-2">
            <Label className="text-sm">תצוגה מקדימה (מסמך לדוגמה)</Label>
            <div className="rounded-2xl bg-cream-100 p-2 sm:p-4">
              <DocumentPreview
                draft={sampleDocumentDraft(business.vatLiable, today)}
                business={{ ...business, logoUrl: logoOnDocuments ? logoUrl : null, signatureUrl: signature }}
                status="draft"
                look={{ template, color }}
                compact
              />
            </div>
          </section>

          {state?.error && (
            <p role="alert" className="text-sm text-terracotta-600">
              {state.error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "שומר…" : "שמירה"}
            </Button>
            {state?.saved && <span className="text-sm text-sage-600">נשמר ✓</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
