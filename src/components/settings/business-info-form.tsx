"use client";

import { startTransition, useActionState, useEffect } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  updateBusinessInfoAction,
  type SettingsFormState,
} from "@/server/actions/settings";

type Props = {
  initial: {
    businessName: string | null;
    businessId: string | null;
    address: string | null;
    defaultRate: string | null;
    vatLiable: boolean;
    /** Settings only (the setup wizard shows the short form) */
    occupation?: string | null;
    businessDescription?: string | null;
    phone?: string | null;
    docEmail?: string | null;
    /** the login email, prefilled as the documents' email until one is saved */
    accountEmail?: string | null;
    website?: string | null;
    businessNameEn?: string | null;
    addressEn?: string | null;
    descriptionEn?: string | null;
  };
  /** the full form, with the document contact details and the English details */
  full?: boolean;
  /**
   * Income/expense documents shown (src/lib/features.ts). When hidden, the
   * fields that exist only for documents (description line, email on
   * documents, English details) are left out; the action keeps a field the
   * form didn't send, so nothing stored is lost.
   */
  documents?: boolean;
  /** the setup wizard submits this form from its own "הבא" button */
  formId?: string;
  onSaved?: () => void;
  hideSave?: boolean;
};

export function BusinessInfoForm({ initial, full = false, documents = true, formId, onSaved, hideSave = false }: Props) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateBusinessInfoAction,
    null,
  );
  useEffect(() => {
    if (state?.saved) onSaved?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per save
  }, [state]);
  const fieldErr = state?.fieldErrors ?? {};
  const err = (name: string) =>
    fieldErr[name]?.[0] ? (
      <p id={`${name}-error`} role="alert" className="text-xs text-terracotta-600 mt-1">
        {fieldErr[name][0]}
      </p>
    ) : null;

  return (
    <form
      id={formId}
      className="space-y-6"
      noValidate
      // By hand, so a refused save keeps what was typed (see CLAUDE.md)
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <Card>
        <CardContent className="space-y-5">
          <h2 className="font-display text-xl text-ink">פרטי העסק</h2>
          {documents && (
            <p className="text-xs text-ink-muted">
              פרטים אלו מופיעים בראש מסמכי ההכנסות.
            </p>
          )}

          <div>
            <Label htmlFor="businessName">שם העסק</Label>
            <Input
              id="businessName"
              name="businessName"
              defaultValue={initial.businessName ?? ""}
              placeholder="אם ריק, יוצג השם המלא"
            />
          </div>

          {full && (
            <>
              <div>
                <Label htmlFor="occupation">עיסוק / מקצוע</Label>
                <Input
                  id="occupation"
                  name="occupation"
                  maxLength={80}
                  defaultValue={initial.occupation ?? ""}
                  placeholder="למשל: פסיכולוגיה קלינית"
                  invalid={!!fieldErr.occupation}
                />
                {err("occupation")}
              </div>
              {documents && (
              <div>
                <Label htmlFor="businessDescription">משפט תיאור העסק</Label>
                <Input
                  id="businessDescription"
                  name="businessDescription"
                  maxLength={160}
                  defaultValue={initial.businessDescription ?? ""}
                  placeholder="למשל: טיפול רגשי למבוגרים ולמתבגרים"
                  aria-describedby="businessDescription-hint"
                  invalid={!!fieldErr.businessDescription}
                />
                <p id="businessDescription-hint" className="text-xs text-ink-muted mt-1">
                  שורה אחת שמופיעה מתחת לשם העסק במסמכים.
                </p>
                {err("businessDescription")}
              </div>
              )}
            </>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="businessId">ע.מ / ע.פ / ח.פ</Label>
              <Input
                id="businessId"
                name="businessId"
                defaultValue={initial.businessId ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="defaultRate">תעריף ברירת מחדל לפגישה (₪)</Label>
              <Input
                id="defaultRate"
                name="defaultRate"
                type="number"
                step="0.01"
                min="0"
                defaultValue={initial.defaultRate ?? ""}
              />
            </div>
          </div>

          {!full && (
            <div>
              <Label htmlFor="address">כתובת</Label>
              <Input id="address" name="address" defaultValue={initial.address ?? ""} />
            </div>
          )}

          <div>
            <Label htmlFor="vatLiable">סטטוס מע״מ</Label>
            <Select
              id="vatLiable"
              name="vatLiable"
              defaultValue={initial.vatLiable ? "true" : "false"}
            >
              <option value="false">עוסק פטור — ללא מע״מ (ברירת מחדל)</option>
              <option value="true">עוסק מורשה — המחירים כוללים מע״מ</option>
            </Select>
            <p className={documents ? "text-xs text-ink-muted mt-1" : "hidden"}>
              לעוסק מורשה, החשבוניות יציגו פירוט מע״מ (המחיר ללקוח נשאר זהה —
              המע״מ מחושב מתוכו).
            </p>
          </div>
        </CardContent>
      </Card>

      {full && (
        // #contact: "המרפאה שלי" links here (src/lib/my-clinic.ts)
        <Card id="contact" className="scroll-mt-24">
          <CardContent className="space-y-5">
            <h2 className="font-display text-xl text-ink">{documents ? "פרטי קשר למסמכים" : "פרטי קשר"}</h2>
            {documents && <p className="text-xs text-ink-muted">מופיעים בראש המסמכים, מתחת לשם העסק.</p>}
            <div>
              <Label htmlFor="address">כתובת</Label>
              <Input id="address" name="address" maxLength={200} defaultValue={initial.address ?? ""} />
            </div>
            <div className={documents ? "grid sm:grid-cols-2 gap-4" : undefined}>
              <div>
                <Label htmlFor="bizPhone">טלפון</Label>
                <Input
                  id="bizPhone"
                  name="phone"
                  type="tel"
                  dir="ltr"
                  maxLength={30}
                  defaultValue={initial.phone ?? ""}
                  invalid={!!fieldErr.phone}
                />
                {err("phone")}
              </div>
              {documents && (
              <div>
                <Label htmlFor="docEmail">אימייל</Label>
                <Input
                  id="docEmail"
                  name="docEmail"
                  type="email"
                  dir="ltr"
                  maxLength={120}
                  defaultValue={initial.docEmail ?? initial.accountEmail ?? ""}
                  invalid={!!fieldErr.docEmail}
                  aria-describedby={fieldErr.docEmail ? "docEmail-error docEmail-hint" : "docEmail-hint"}
                />
                <p id="docEmail-hint" className="text-xs text-ink-muted mt-1">
                  {initial.docEmail === null || initial.docEmail === undefined
                    ? "מולא מאימייל החשבון. אפשר לשנות, או למחוק כדי שלא יופיע במסמכים."
                    : "ריק = לא מופיע במסמכים."}
                </p>
                {err("docEmail")}
              </div>
              )}
            </div>
            <div>
              <Label htmlFor="website">אתר</Label>
              <Input
                id="website"
                name="website"
                dir="ltr"
                maxLength={120}
                defaultValue={initial.website ?? ""}
                placeholder="www.example.co.il"
                invalid={!!fieldErr.website}
              />
              {err("website")}
            </div>
          </CardContent>
        </Card>
      )}

      {full && documents && (
        <Card>
          <CardContent className="space-y-5">
            <h2 className="font-display text-xl text-ink">פרטי העסק באנגלית</h2>
            <p className="text-xs text-ink-muted">לא חובה. ישמשו למסמכים באנגלית.</p>
            <div>
              <Label htmlFor="businessNameEn">שם העסק באנגלית</Label>
              <Input
                id="businessNameEn"
                name="businessNameEn"
                dir="ltr"
                maxLength={120}
                defaultValue={initial.businessNameEn ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="addressEn">כתובת באנגלית</Label>
              <Input id="addressEn" name="addressEn" dir="ltr" maxLength={200} defaultValue={initial.addressEn ?? ""} />
            </div>
            <div>
              <Label htmlFor="descriptionEn">משפט תיאור העסק באנגלית</Label>
              <Input
                id="descriptionEn"
                name="descriptionEn"
                dir="ltr"
                maxLength={160}
                defaultValue={initial.descriptionEn ?? ""}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {state?.error && (
        <div role="alert" className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}

      <div className={hideSave ? "hidden" : "flex items-center justify-between"}>
        <div className="text-xs">
          {state?.saved && (
            <span className="inline-flex items-center gap-1 text-sage-600">
              <Check className="w-3.5 h-3.5" />
              נשמר
            </span>
          )}
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "שומר…" : "שמירת שינויים"}
        </Button>
      </div>
    </form>
  );
}
