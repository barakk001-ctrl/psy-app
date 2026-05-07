"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  updateBusinessInfoAction,
  type SettingsFormState,
} from "@/server/actions/settings";

type Props = {
  initial: {
    name: string;
    businessName: string | null;
    businessId: string | null;
    address: string | null;
    phone: string | null;
    defaultRate: string | null;
  };
};

export function BusinessInfoForm({ initial }: Props) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updateBusinessInfoAction,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Card>
        <CardContent className="space-y-5">
          <h2 className="font-display text-xl text-ink">פרטי קשר</h2>

          <div>
            <Label htmlFor="name">שם מלא *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={initial.name}
              invalid={!!fieldErr.name}
            />
            {fieldErr.name && (
              <p className="text-xs text-terracotta-600 mt-1">{fieldErr.name[0]}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">טלפון</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={initial.phone ?? ""}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <h2 className="font-display text-xl text-ink">פרטי העסק</h2>
          <p className="text-xs text-ink-muted">
            פרטים אלו מופיעים בראש החשבוניות שאתם מפיקים.
          </p>

          <div>
            <Label htmlFor="businessName">שם העסק</Label>
            <Input
              id="businessName"
              name="businessName"
              defaultValue={initial.businessName ?? ""}
              placeholder="אם ריק, יוצג השם המלא"
            />
          </div>

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

          <div>
            <Label htmlFor="address">כתובת</Label>
            <Input
              id="address"
              name="address"
              defaultValue={initial.address ?? ""}
            />
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
