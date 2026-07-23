"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  ClipboardPaste,
  FileText,
  Inbox,
  Sparkles,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  deleteInboxMessageAction,
  processInboxMessageAction,
} from "@/server/actions/inbox";
import { appendNoteToSessionAction } from "@/server/actions/notes";
import {
  matchClient,
  parseAppointmentMessage,
  type ClientCandidate,
  type ParsedMessage,
} from "@/lib/message-parse";

export type InboxItem = { id: string; text: string; createdAt: string };

export type SessionOption = {
  id: string;
  clientId: string;
  label: string;
  /** yyyy-MM-dd in clinic time, for matching a date mentioned in the message */
  localDate: string;
  isPast: boolean;
};

export function ImportMessageForm({
  clients,
  inbox = [],
  sessions = [],
}: {
  clients: ClientCandidate[];
  inbox?: InboxItem[];
  sessions?: SessionOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedMessage | null>(null);
  const [clientId, setClientId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [attachSessionId, setAttachSessionId] = useState("");
  const [attachState, setAttachState] = useState<{
    saving?: boolean;
    savedSessionId?: string;
    error?: string;
  }>({});

  function suggestSession(cid: string, parsedDate: string | null): string {
    const pool = sessions.filter((s) => !cid || s.clientId === cid);
    if (parsedDate) {
      const onDate = pool.find((s) => s.localDate === parsedDate);
      if (onDate) return onDate.id;
    }
    // Most recent past session (list is sorted desc)
    return pool.find((s) => s.isPast)?.id ?? pool[0]?.id ?? "";
  }

  function runParse(input: string) {
    const result = parseAppointmentMessage(input);
    setParsed(result);
    setStartsAt(result.startsAt ?? "");
    const match = matchClient(clients, input, result.phone);
    const cid = match?.id ?? "";
    setClientId(cid);
    setAttachSessionId(suggestSession(cid, result.startsAt?.slice(0, 10) ?? null));
    setAttachState({});
  }

  function attachToSession() {
    if (!attachSessionId || !text.trim()) return;
    setAttachState({ saving: true });
    startTransition(async () => {
      const res = await appendNoteToSessionAction(attachSessionId, text);
      if (res.ok) {
        setAttachState({ savedSessionId: attachSessionId });
      } else {
        setAttachState({ error: res.error });
      }
    });
  }

  function handleParse() {
    runParse(text);
  }

  function loadInboxItem(item: InboxItem) {
    setText(item.text);
    runParse(item.text);
    startTransition(async () => {
      await processInboxMessageAction(item.id);
      router.refresh();
    });
  }

  function removeInboxItem(id: string) {
    startTransition(async () => {
      await deleteInboxMessageAction(id);
      router.refresh();
    });
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
      {inbox.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5 text-sage-600" />
              הודעות שהתקבלו ({inbox.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-cream-200">
              {inbox.map((item) => (
                <li
                  key={item.id}
                  className="px-5 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-soft line-clamp-2 whitespace-pre-wrap">
                      {item.text}
                    </p>
                    <p className="text-xs text-ink-subtle mt-0.5">
                      {new Intl.DateTimeFormat("he-IL", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Asia/Jerusalem",
                      }).format(new Date(item.createdAt))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => loadInboxItem(item)}
                    >
                      עיבוד
                    </Button>
                    <button
                      type="button"
                      onClick={() => removeInboxItem(item.id)}
                      className="text-ink-muted hover:text-terracotta-500 p-1"
                      aria-label="מחיקה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

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
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setAttachSessionId(
                      suggestSession(e.target.value, parsed?.startsAt?.slice(0, 10) ?? null),
                    );
                  }}
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

            {sessions.length > 0 && (
              <div className="border-t border-cream-200 pt-4 space-y-3">
                <p className="text-sm font-medium text-ink">
                  או: ההודעה היא סיכום — שמירה לפגישה קיימת
                </p>
                <p className="text-xs text-ink-muted">
                  התוכן יתווסף לסיכום המוצפן של הפגישה שתיבחר.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-56">
                    <Label htmlFor="attachSession">פגישה</Label>
                    <Select
                      id="attachSession"
                      value={attachSessionId}
                      onChange={(e) => setAttachSessionId(e.target.value)}
                    >
                      <option value="">— בחר/י פגישה —</option>
                      {sessions
                        .filter((s) => !clientId || s.clientId === clientId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={attachToSession}
                    disabled={!attachSessionId || !!attachState.saving}
                  >
                    <FileText className="w-4 h-4" />
                    {attachState.saving ? "שומר…" : "שמירה כסיכום"}
                  </Button>
                </div>
                {attachState.savedSessionId && (
                  <p className="text-sm text-sage-700">
                    הסיכום נשמר ✓{" "}
                    <button
                      type="button"
                      onClick={() => router.push(`/sessions/${attachState.savedSessionId}`)}
                      className="underline text-sage-600 hover:text-sage-700"
                    >
                      לפגישה ←
                    </button>
                  </p>
                )}
                {attachState.error && (
                  <p className="text-sm text-terracotta-600">{attachState.error}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
