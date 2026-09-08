"use client";

import { useActionState } from "react";
import { Check, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  updatePersonalDetailsAction,
  type SettingsFormState,
} from "@/server/actions/settings";

export function PersonalDetailsForm({
  initial,
}: {
  initial: { name: string; email: string; phone: string | null };
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(
    updatePersonalDetailsAction,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="w-5 h-5 text-sage-600" />
          פרטים אישיים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="pdName">שם מלא *</Label>
            <Input
              id="pdName"
              name="name"
              required
              defaultValue={initial.name}
              invalid={!!fieldErr.name}
            />
            {fieldErr.name && (
              <p className="text-xs text-terracotta-600 mt-1">{fieldErr.name[0]}</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pdEmail">אימייל (משמש להתחברות)</Label>
              <Input
                id="pdEmail"
                name="email"
                type="email"
                dir="ltr"
                required
                defaultValue={initial.email}
                invalid={!!fieldErr.email}
              />
              {fieldErr.email && (
                <p className="text-xs text-terracotta-600 mt-1">{fieldErr.email[0]}</p>
              )}
            </div>
            <div>
              <Label htmlFor="pdPhone">טלפון</Label>
              <Input
                id="pdPhone"
                name="phone"
                type="tel"
                dir="ltr"
                defaultValue={initial.phone ?? ""}
              />
            </div>
          </div>

          {state?.error && (
            <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
              {state.error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs">
              {state?.saved && (
                <span className="inline-flex items-center gap-1 text-sage-600">
                  <Check className="w-3.5 h-3.5" /> נשמר
                </span>
              )}
            </span>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "שומר…" : "שמירה"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
