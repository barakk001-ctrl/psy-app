"use client";

import { startTransition, useActionState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DOC_CURRENCIES,
  DOC_CURRENCY_LABELS,
  DOC_LANGS,
  DOC_LANG_LABELS,
  DOC_VAT_TYPES,
  DOC_VAT_TYPE_LABELS,
  type DocumentDefaults,
} from "@/lib/billing-docs";
import { updateDocumentDefaultsAction, type SettingsFormState } from "@/server/actions/settings";

/** Settings → ברירות מחדל למסמכים. Each document can still change them. */
export function DocumentDefaultsCard({
  defaults,
  vatLiable,
}: {
  defaults: DocumentDefaults;
  vatLiable: boolean;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateDocumentDefaultsAction,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-sage-600" />
          ברירות מחדל למסמכים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
        >
          <p className="text-sm text-ink-muted">
            כל מסמך חדש מתחיל מההגדרות האלה, ואפשר לשנות אותן במסמך עצמו.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="docCurrency">מטבע</Label>
              <Select id="docCurrency" name="docCurrency" defaultValue={defaults.currency}>
                {DOC_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {DOC_CURRENCY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="docLang">שפה</Label>
              <Select id="docLang" name="docLang" defaultValue={defaults.lang}>
                {DOC_LANGS.map((l) => (
                  <option key={l} value={l}>
                    {DOC_LANG_LABELS[l]}
                  </option>
                ))}
              </Select>
            </div>
            {vatLiable && (
              <div>
                <Label htmlFor="docVatType">סוג מע״מ</Label>
                <Select id="docVatType" name="docVatType" defaultValue={String(defaults.vatType)}>
                  {DOC_VAT_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {DOC_VAT_TYPE_LABELS[v]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="docRounding"
              defaultChecked={defaults.rounding}
              className="h-4 w-4 rounded border-cream-300 accent-sage-600"
            />
            עיגול סכומים
          </label>
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
