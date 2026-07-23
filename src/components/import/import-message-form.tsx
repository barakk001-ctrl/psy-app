"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardPaste, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  matchClient,
  parseAppointmentMessage,
  type ClientCandidate,
  type ParsedMessage,
} from "@/lib/message-parse";

export function ImportMessageForm({ clients }: { clients: ClientCandidate[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedMessage | null>(null);
  const [clientId, setClientId] = useState("");
  const [startsAt, setStartsAt] = useState("");

  function handleParse() {
    const result = parseAppointmentMessage(text);
    setParsed(result);
    setStartsAt(result.startsAt ?? "");
    const match = matchClient(clients, text, result.phone);
    setClientId(match?.id ?? "");
  }

  async function pasteFromClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText(clip);
    } catch {
      // Clipboard permission denied — user can paste manually
    }
  }

  function continueToSession() {
    const params = new URLSearchParams();
    if (startsAt) params.set("start", startsAt);
    if (clientId) params.set("clientId", clientId);
    router.push(`/sessions/new?${params.toString()}`);
  }

  function continueToNewClient() {
    const params = new URLSearchParams();
    const guess = (parsed?.nameGuess ?? "").split(/\s+/);
    if (guess[0]) params.set("firstName", guess[0]);
    if (guess.length > 1) params.set("lastName", guess.slice(1).join(" "));
    if (parsed?.phone) params.set("phone", parsed.phone);
    if (startsAt) params.set("nextStart", startsAt);
    router.push(`/clients/new?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="message">תוכן ההודעה</Label>
            <Button type="button" variant="ghost" size="sm" onClick={pasteFromClipboard}>
              <ClipboardPaste className="w-4 h-4" />
              הדבקה
            </Button>
          </div>
          <Textarea
            id="message"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"למשל:\nהיי, אפשר לקבוע ליום שלישי ב-16:00?\nדנה כהן"}
          />
          <div className="flex justify-end">
            <Button type="button" onClick={handleParse} disabled={!text.trim()}>
              <Sparkles className="w-4 h-4" />
              זיהוי פרטים
            </Button>
          </div>
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardContent className="space-y-5">
            <h2 className="font-display text-xl text-ink">מה זיהינו</h2>

            <div className="flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-full px-3 py-1 border ${
                  parsed.dateFound
                    ? "bg-sage-50 border-sage-100 text-sage-700"
                    : "bg-cream-100 border-cream-300 text-ink-muted"
                }`}
              >
                {parsed.dateFound ? "תאריך זוהה ✓" : "תאריך לא זוהה"}
              </span>
              <span
                className={`rounded-full px-3 py-1 border ${
                  parsed.timeFound
                    ? "bg-sage-50 border-sage-100 text-sage-700"
                    : "bg-cream-100 border-cream-300 text-ink-muted"
                }`}
              >
                {parsed.timeFound ? "שעה זוהתה ✓" : "שעה לא זוהתה"}
              </span>
              {parsed.phone && (
                <span className="rounded-full px-3 py-1 border bg-sage-50 border-sage-100 text-sage-700">
                  טלפון: <span dir="ltr">{parsed.phone}</span>
                </span>
              )}
              {parsed.location && (
                <span className="rounded-full px-3 py-1 border bg-sage-50 border-sage-100 text-sage-700">
                  {parsed.location === "ONLINE" ? "פגישה מקוונת" : "בקליניקה"}
                </span>
              )}
              {parsed.nameGuess && !clientId && (
                <span className="rounded-full px-3 py-1 border bg-cream-100 border-cream-300 text-ink-muted">
                  שם משוער: {parsed.nameGuess}
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="importStartsAt">תאריך ושעה</Label>
                <Input
                  id="importStartsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="importClient">לקוח/ה</Label>
                <Select
                  id="importClient"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">— לא זוהה, בחר/י —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </Select>
                {clientId && (
                  <p className="text-xs text-sage-600 mt-1">לקוח/ה זוהה אוטומטית ✓</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-end pt-2">
              {!clientId && (
                <Button type="button" variant="secondary" onClick={continueToNewClient}>
                  <UserPlus className="w-4 h-4" />
                  יצירת לקוח/ה חדש/ה מהפרטים
                </Button>
              )}
              <Button type="button" onClick={continueToSession} disabled={!startsAt}>
                <CalendarPlus className="w-4 h-4" />
                המשך ליצירת הפגישה
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
