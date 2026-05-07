"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from "@/server/actions/clients";

export type ClientFormInitial = {
  id: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null; // ISO yyyy-mm-dd or null
  address: string | null;
  defaultRate: string | null;
  generalNotes: string | null;
};

export function ClientForm({ initial }: { initial?: ClientFormInitial }) {
  const isEdit = !!initial;
  const action = isEdit ? updateClientAction : createClientAction;

  const [state, formAction, pending] = useActionState<ClientFormState, FormData>(
    action,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {isEdit && <input type="hidden" name="id" value={initial!.id} />}

      <Card>
        <CardContent className="space-y-5">
          <h2 className="font-display text-xl text-ink">פרטים אישיים</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">שם פרטי *</Label>
              <Input
                id="firstName"
                name="firstName"
                required
                defaultValue={initial?.firstName ?? ""}
                invalid={!!fieldErr.firstName}
              />
              {fieldErr.firstName && (
                <p className="text-xs text-terracotta-600 mt-1">{fieldErr.firstName[0]}</p>
              )}
            </div>
            <div>
              <Label htmlFor="lastName">שם משפחה *</Label>
              <Input
                id="lastName"
                name="lastName"
                required
                defaultValue={initial?.lastName ?? ""}
                invalid={!!fieldErr.lastName}
              />
              {fieldErr.lastName && (
                <p className="text-xs text-terracotta-600 mt-1">{fieldErr.lastName[0]}</p>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="idNumber">תעודת זהות</Label>
              <Input
                id="idNumber"
                name="idNumber"
                inputMode="numeric"
                defaultValue={initial?.idNumber ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="dateOfBirth">תאריך לידה</Label>
              <Input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                defaultValue={initial?.dateOfBirth ?? ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <h2 className="font-display text-xl text-ink">פרטי קשר</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={initial?.email ?? ""}
                invalid={!!fieldErr.email}
              />
              {fieldErr.email && (
                <p className="text-xs text-terracotta-600 mt-1">{fieldErr.email[0]}</p>
              )}
            </div>
            <div>
              <Label htmlFor="phone">טלפון</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={initial?.phone ?? ""}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">כתובת</Label>
            <Input id="address" name="address" defaultValue={initial?.address ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5">
          <h2 className="font-display text-xl text-ink">הגדרות</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="defaultRate">תעריף לפגישה (₪)</Label>
              <Input
                id="defaultRate"
                name="defaultRate"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                defaultValue={initial?.defaultRate ?? ""}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="generalNotes">הערות כלליות</Label>
            <Textarea
              id="generalNotes"
              name="generalNotes"
              rows={3}
              defaultValue={initial?.generalNotes ?? ""}
              placeholder="הערות שאינן רפואיות — העדפות, אופן יצירת קשר וכו׳"
            />
            <p className="text-xs text-ink-subtle mt-1">
              סיכומים קליניים מנוהלים בנפרד בכל פגישה ומוצפנים.
            </p>
          </div>
        </CardContent>
      </Card>

      {state?.error && (
        <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end">
        <Link href={isEdit ? `/clients/${initial!.id}` : "/clients"}>
          <Button type="button" variant="ghost">
            ביטול
          </Button>
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </form>
  );
}
