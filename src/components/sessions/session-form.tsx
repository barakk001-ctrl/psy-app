"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  createSessionAction,
  type SessionFormState,
} from "@/server/actions/sessions";

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
  defaultRate: string | null;
};

export function SessionForm({
  clients,
  defaults,
}: {
  clients: ClientOption[];
  defaults?: { startsAt?: string; clientId?: string };
}) {
  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(
    createSessionAction,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  const [location, setLocation] = useState<string>("OFFICE");
  const [clientId, setClientId] = useState<string>(defaults?.clientId ?? "");

  const selectedClient = clients.find((c) => c.id === clientId);
  const ratePlaceholder = selectedClient?.defaultRate ?? "";

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Card>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="clientId">לקוח/ה *</Label>
            <Select
              id="clientId"
              name="clientId"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="" disabled>
                בחר/י לקוח/ה
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </Select>
            {fieldErr.clientId && (
              <p className="text-xs text-terracotta-600 mt-1">{fieldErr.clientId[0]}</p>
            )}
            {clients.length === 0 && (
              <p className="text-xs text-ink-muted mt-1">
                עוד אין לקוחות —{" "}
                <Link href="/clients/new" className="text-sage-600 hover:text-sage-700">
                  הוספת לקוח חדש
                </Link>
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startsAt">תאריך ושעה *</Label>
              <Input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                required
                defaultValue={defaults?.startsAt}
                invalid={!!fieldErr.startsAt}
              />
              {fieldErr.startsAt && (
                <p className="text-xs text-terracotta-600 mt-1">{fieldErr.startsAt[0]}</p>
              )}
            </div>
            <div>
              <Label htmlFor="durationMinutes">משך (דקות) *</Label>
              <Select id="durationMinutes" name="durationMinutes" defaultValue="50">
                <option value="30">30</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="60">60</option>
                <option value="75">75</option>
                <option value="90">90</option>
                <option value="120">120</option>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="location">מיקום</Label>
              <Select
                id="location"
                name="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                <option value="OFFICE">קליניקה</option>
                <option value="ONLINE">מקוון</option>
                <option value="HOME_VISIT">ביקור בית</option>
                <option value="OTHER">אחר</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="rate">תעריף לפגישה (₪)</Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                step="0.01"
                min="0"
                placeholder={ratePlaceholder ? `ברירת מחדל: ${ratePlaceholder}` : "ללא"}
              />
            </div>
          </div>

          {location === "ONLINE" && (
            <div>
              <Label htmlFor="meetingUrl">קישור לפגישה *</Label>
              <Input
                id="meetingUrl"
                name="meetingUrl"
                type="url"
                placeholder="https://…"
                invalid={!!fieldErr.meetingUrl}
              />
              {fieldErr.meetingUrl && (
                <p className="text-xs text-terracotta-600 mt-1">{fieldErr.meetingUrl[0]}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {state?.error && !state.fieldErrors && (
        <div className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end">
        <Link href="/calendar">
          <Button type="button" variant="ghost">
            ביטול
          </Button>
        </Link>
        <Button type="submit" disabled={pending || clients.length === 0}>
          {pending ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </form>
  );
}
