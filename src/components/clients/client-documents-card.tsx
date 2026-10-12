"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CloudUpload,
  Download,
  Eye,
  FileImage,
  FileText,
  FileType,
  Loader2,
  Lock,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { isStandaloneApp } from "@/components/ui/pdf-button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { signalActivity } from "@/lib/idle-timeout";
import {
  ALLOWED_TYPES_LABEL,
  CATEGORY_LABELS,
  DOCUMENT_ACCEPT,
  DOCUMENT_CATEGORIES,
  MAX_DESCRIPTION_LENGTH,
  MAX_DOCUMENTS_PER_BATCH,
  MAX_DOCUMENT_LABEL,
  MAX_NAME_LENGTH,
  canViewInline,
  documentKind,
  documentMetaError,
  documentTypeLabel,
  formatFileSize,
  sniffDocumentType,
  type DocumentCategory,
} from "@/lib/client-documents";
import {
  deleteClientDocumentAction,
  updateClientDocumentAction,
  uploadClientDocumentAction,
  type ClientDocumentView,
} from "@/server/actions/client-documents";

export type ClientDocumentItem = ClientDocumentView;

export type SessionFileItem = {
  id: string;
  fileName: string;
  size: number;
  createdAt: string;
  sessionId: string;
};

type Staged = {
  key: string;
  file: File;
  category: DocumentCategory | "";
  description: string;
  status: "checking" | "ready" | "invalid" | "uploading" | "done" | "failed";
  error?: string;
};

/** While an upload runs, the idle guard is told every this often. */
const KEEP_ALIVE_MS = 20_000;

function docUrl(id: string, download = false) {
  return `/api/documents/${id}${download ? "?download=1" : ""}`;
}

function DocIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const kind = documentKind(mimeType);
  const Icon = kind === "pdf" ? FileText : kind === "image" ? FileImage : FileType;
  return (
    <span
      className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
        kind === "pdf" && "bg-terracotta-500/10 border-terracotta-500/20 text-terracotta-600",
        kind === "word" && "bg-sage-50 border-sage-100 text-sage-700",
        kind === "image" && "bg-gold-200/50 border-gold-300/60 text-ink-soft",
        className,
      )}
      aria-hidden
    >
      <Icon className="w-5 h-5" />
    </span>
  );
}

/** Reads the whole file in the browser and runs the same checks as the server. */
async function checkInBrowser(file: File): Promise<string | null> {
  const metaError = documentMetaError({ name: file.name, size: file.size });
  if (metaError) return metaError;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!sniffDocumentType(bytes)) return `הקובץ אינו ${ALLOWED_TYPES_LABEL} תקין`;
  } catch {
    return "לא ניתן לקרוא את הקובץ";
  }
  return null;
}

export function ClientDocumentsCard({
  clientId,
  documents,
  sessionFiles,
}: {
  clientId: string;
  documents: ClientDocumentItem[];
  sessionFiles: SessionFileItem[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<Staged[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [, startRefresh] = useTransition();
  // The list as the actions report it, so it changes at once; whatever the
  // server renders next (refresh) replaces it.
  const [list, setList] = useState(documents);
  useEffect(() => setList(documents), [documents]);
  const refresh = () => startRefresh(() => router.refresh());

  // Leaving the page mid-upload would drop the files not sent yet
  useEffect(() => {
    if (!uploading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [uploading]);

  const update = (key: string, patch: Partial<Staged>) =>
    setStaged((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (files.length === 0 || uploading) return;
    setNotice(null);
    setPickError(null);
    const room = MAX_DOCUMENTS_PER_BATCH - staged.filter((s) => s.status !== "done").length;
    if (files.length > room) {
      setPickError(`אפשר להעלות עד ${MAX_DOCUMENTS_PER_BATCH} קבצים בכל פעם.`);
    }
    const added: Staged[] = files.slice(0, Math.max(0, room)).map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`,
      file,
      category: "",
      description: "",
      status: "checking",
    }));
    setStaged((list) => [...list.filter((s) => s.status !== "done"), ...added]);
    for (const s of added) {
      void checkInBrowser(s.file).then((error) =>
        update(s.key, error ? { status: "invalid", error } : { status: "ready" }),
      );
    }
  }

  async function uploadAll() {
    const queue = staged.filter((s) => s.status === "ready" || s.status === "failed");
    if (queue.length === 0) return;
    setUploading(true);
    setNotice(null);
    let ok = 0;
    for (const s of queue) {
      update(s.key, { status: "uploading", error: undefined });
      const fd = new FormData();
      fd.set("clientId", clientId);
      fd.set("file", s.file, s.file.name);
      fd.set("category", s.category);
      fd.set("description", s.description);
      signalActivity();
      const keepAlive = window.setInterval(signalActivity, KEEP_ALIVE_MS);
      try {
        const res = await uploadClientDocumentAction(fd);
        if ("error" in res) {
          update(s.key, { status: "failed", error: res.error });
        } else {
          ok++;
          update(s.key, { status: "done" });
          const added = res.document;
          setList((docs) => [added, ...docs.filter((d) => d.id !== added.id)]);
        }
      } catch {
        update(s.key, { status: "failed", error: "ההעלאה נכשלה — בדקו את החיבור ונסו שוב" });
      } finally {
        window.clearInterval(keepAlive);
      }
    }
    setUploading(false);
    signalActivity();
    if (ok > 0) {
      setNotice(ok === 1 ? "המסמך הועלה ונשמר מוצפן." : `${ok} מסמכים הועלו ונשמרו מוצפנים.`);
      setStaged((list) => list.filter((s) => s.status !== "done"));
      refresh();
    }
  }

  const readyCount = staged.filter((s) => s.status === "ready" || s.status === "failed").length;
  const checking = staged.some((s) => s.status === "checking");

  return (
    <Card className="lg:col-span-3">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <CardTitle>מסמכים</CardTitle>
          <p className="text-xs text-ink-muted mt-1 inline-flex items-center gap-1">
            <Lock className="w-3 h-3" />
            הפניות, אבחונים, טפסי הסכמה וטפסים — נשמרים מוצפנים
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <CloudUpload className="w-4 h-4" />
          העלאת מסמכים
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept={DOCUMENT_ACCEPT}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Desktop: a drop zone. Phone: the button above opens the picker
            (Photos, Files, iCloud) — no zone taking up the screen. */}
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "hidden md:block w-full rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors disabled:opacity-60",
            dragOver
              ? "border-sage-500 bg-sage-50"
              : "border-cream-300 hover:border-sage-300 bg-cream-100/50",
          )}
        >
          <CloudUpload className="w-7 h-7 mx-auto text-sage-600 mb-2" />
          <span className="block text-sm text-ink-soft">
            גוררים לכאן קבצים, או לוחצים לבחירה (אפשר כמה יחד)
          </span>
          <span className="block text-xs text-ink-subtle mt-1">
            {ALLOWED_TYPES_LABEL} · עד {MAX_DOCUMENT_LABEL} לקובץ
          </span>
        </button>
        <p className="md:hidden text-xs text-ink-subtle leading-relaxed">
          אפשר לבחור כמה קבצים יחד — מהתמונות, מ״קבצים״ או מתוך iCloud. {ALLOWED_TYPES_LABEL}, עד{" "}
          {MAX_DOCUMENT_LABEL} לקובץ.
        </p>

        {pickError && <p className="text-sm text-terracotta-600">{pickError}</p>}

        {staged.length > 0 && (
          <div className="rounded-xl border border-sage-100 bg-sage-50/60 p-3 sm:p-4 space-y-3">
            <p className="text-sm font-medium text-ink">
              {uploading ? "מעלה…" : "לפני ההעלאה — אפשר לבחור סיווג ולהוסיף תיאור קצר"}
            </p>
            <ul className="space-y-2">
              {staged.map((s) => (
                <li
                  key={s.key}
                  className="rounded-lg bg-white/80 border border-cream-200 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-1 min-w-0 text-sm text-ink truncate" dir="auto">
                      {s.file.name}
                    </span>
                    <span className="text-xs text-ink-subtle shrink-0" dir="ltr">
                      {formatFileSize(s.file.size)}
                    </span>
                    {s.status === "uploading" && (
                      <Loader2 className="w-4 h-4 text-sage-600 animate-spin shrink-0" aria-label="מעלה" />
                    )}
                    {s.status === "done" && (
                      <CheckCircle2 className="w-4 h-4 text-sage-600 shrink-0" aria-label="הועלה" />
                    )}
                    {!uploading && s.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => setStaged((list) => list.filter((x) => x.key !== s.key))}
                        aria-label={`הסרת ${s.file.name} מהרשימה`}
                        className="p-1 text-ink-subtle hover:text-ink shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {s.status === "checking" && <p className="text-xs text-ink-muted">בודק את הקובץ…</p>}
                  {s.error && <p className="text-xs text-terracotta-600">{s.error}</p>}
                  {(s.status === "ready" || s.status === "failed" || s.status === "uploading") && (
                    <div className="grid gap-2 sm:grid-cols-[11rem_1fr]">
                      <Select
                        aria-label="סיווג"
                        value={s.category}
                        disabled={uploading}
                        onChange={(e) => update(s.key, { category: e.target.value as DocumentCategory | "" })}
                        className="h-9 text-sm"
                      >
                        <option value="">ללא סיווג</option>
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </Select>
                      <Input
                        aria-label="תיאור קצר (לא חובה)"
                        placeholder="תיאור קצר (לא חובה)"
                        value={s.description}
                        maxLength={MAX_DESCRIPTION_LENGTH}
                        disabled={uploading}
                        onChange={(e) => update(s.key, { description: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={uploading || checking || readyCount === 0}
                onClick={() => void uploadAll()}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                {uploading
                  ? "מעלה…"
                  : readyCount === 1
                    ? "העלאת הקובץ"
                    : `העלאת ${readyCount} קבצים`}
              </Button>
              {!uploading && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setStaged([])}>
                  ביטול
                </Button>
              )}
              {uploading && (
                <span className="text-xs text-ink-muted">אפשר להמשיך לעבוד — לא לסגור את העמוד עד לסיום.</span>
              )}
            </div>
          </div>
        )}

        {notice && (
          <p role="status" className="text-sm text-sage-700 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {notice}
          </p>
        )}

        {list.length === 0 ? (
          staged.length === 0 && (
            <p className="text-sm text-ink-muted text-center py-2">עדיין לא הועלו מסמכים לתיק.</p>
          )
        ) : (
          <ul className="divide-y divide-cream-200 -mx-5 border-t border-cream-200">
            {list.map((d) => (
              <DocumentRow
                key={d.id}
                doc={d}
                onSaved={(saved) => {
                  setList((docs) => docs.map((x) => (x.id === saved.id ? saved : x)));
                  refresh();
                }}
                onDeleted={() => {
                  setList((docs) => docs.filter((x) => x.id !== d.id));
                  refresh();
                }}
              />
            ))}
          </ul>
        )}

        {sessionFiles.length > 0 && (
          <div className="pt-2">
            <h4 className="text-sm font-medium text-ink-soft mb-1 inline-flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-ink-subtle" />
              קבצים שצורפו לפגישות
            </h4>
            <ul className="divide-y divide-cream-200">
              {sessionFiles.map((f) => (
                <li key={f.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={`/api/files/${f.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-ink hover:text-sage-700 truncate block"
                      dir="auto"
                    >
                      {f.fileName}
                    </a>
                    <div className="text-xs text-ink-subtle mt-0.5">
                      {formatDate(f.createdAt)} · <span dir="ltr">{formatFileSize(f.size)}</span>
                    </div>
                  </div>
                  <Link
                    href={`/sessions/${f.sessionId}`}
                    className="text-xs text-sage-600 hover:text-sage-700 shrink-0"
                  >
                    לפגישה ←
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ACTION_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-soft hover:bg-cream-200/70 disabled:opacity-50 transition-colors";

function DocumentRow({
  doc,
  onSaved,
  onDeleted,
}: {
  doc: ClientDocumentItem;
  onSaved: (doc: ClientDocumentItem) => void;
  onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  // Installed app: the file was fetched but the share sheet needs a fresh tap
  const [ready, setReady] = useState<File | null>(null);
  const inline = canViewInline(doc.mimeType);

  /**
   * In the installed iPhone app a new tab would leave the app with no way
   * back, so the file is fetched and handed to the share sheet (preview,
   * "Save to Files"). In a browser, plain links do the job.
   */
  async function openInApp(e: React.MouseEvent, kind: "view" | "download") {
    if (!isStandaloneApp() || typeof navigator.share !== "function") return;
    e.preventDefault();
    setError(null);
    setBusy(kind);
    try {
      const res = await fetch(docUrl(doc.id, kind === "download"), { credentials: "same-origin" });
      if (!res.ok) {
        setError(res.status === 401 ? "החיבור פג — יש להתחבר מחדש." : "לא ניתן לפתוח את הקובץ.");
        return;
      }
      const file = new File([await res.blob()], doc.name, { type: doc.mimeType });
      try {
        await navigator.share({ files: [file] });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setReady(file); // the tap's permission ran out while downloading
      }
    } catch {
      setError("אין חיבור — נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await updateClientDocumentAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setError(null);
      setMode("idle");
      onSaved(r.document);
    });
  };

  const remove = () => {
    const fd = new FormData();
    fd.set("id", doc.id);
    startTransition(async () => {
      const r = await deleteClientDocumentAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onDeleted();
    });
  };

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-3 gap-y-1.5">
        <DocIcon mimeType={doc.mimeType} />
        <div className="flex-1 min-w-0">
          <a
            href={docUrl(doc.id, !inline)}
            target={inline ? "_blank" : undefined}
            rel="noopener noreferrer"
            onClick={(e) => void openInApp(e, inline ? "view" : "download")}
            className="text-sm font-medium text-ink hover:text-sage-700 break-words"
            dir="auto"
          >
            {doc.name}
          </a>
          <div className="text-xs text-ink-subtle mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>{documentTypeLabel(doc.mimeType)}</span>
            <span aria-hidden>·</span>
            <span dir="ltr">{formatFileSize(doc.size)}</span>
            <span aria-hidden>·</span>
            <span>הועלה {formatDate(doc.createdAt)}</span>
            {doc.category && (
              <span className="rounded-full bg-sage-50 border border-sage-100 text-sage-700 px-2 py-0.5 text-[11px]">
                {CATEGORY_LABELS[doc.category]}
              </span>
            )}
          </div>
          {doc.description && mode !== "edit" && (
            <p className="text-xs text-ink-muted mt-1 leading-relaxed" dir="auto">
              {doc.description}
            </p>
          )}
        </div>
        {mode === "idle" && (
          // Phones: a row of its own under the name; wider screens: beside it
          <div className="basis-full sm:basis-auto -ms-2 sm:ms-0 flex flex-wrap items-center sm:justify-end gap-0.5 shrink-0">
            {inline && (
              <a
                href={docUrl(doc.id)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => void openInApp(e, "view")}
                className={ACTION_BTN}
                title="צפייה"
                aria-label={`צפייה ב-${doc.name}`}
              >
                {busy === "view" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                <span>צפייה</span>
              </a>
            )}
            <a
              href={docUrl(doc.id, true)}
              onClick={(e) => void openInApp(e, "download")}
              className={ACTION_BTN}
              title="הורדה"
              aria-label={`הורדת ${doc.name}`}
            >
              {busy === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>הורדה</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("edit");
              }}
              className={ACTION_BTN}
              title="עריכה"
              aria-label={`עריכת ${doc.name}`}
            >
              <Pencil className="w-4 h-4" />
              <span>עריכה</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("delete");
              }}
              className={cn(ACTION_BTN, "text-terracotta-600 hover:bg-terracotta-500/10")}
              title="מחיקה"
              aria-label={`מחיקת ${doc.name}`}
            >
              <Trash2 className="w-4 h-4" />
              <span>מחיקה</span>
            </button>
          </div>
        )}
      </div>

      {ready && (
        <div className="mt-2 ms-[3.25rem] flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              const file = ready;
              setReady(null);
              try {
                await navigator.share({ files: [file] });
              } catch {
                // closed the sheet
              }
            }}
          >
            <Eye className="w-4 h-4" />
            הקובץ מוכן — פתיחה
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setReady(null)}>
            סגירה
          </Button>
        </div>
      )}

      {mode === "edit" && (
        <form onSubmit={save} className="mt-3 ms-0 sm:ms-[3.25rem] space-y-2">
          <input type="hidden" name="id" value={doc.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">שם הקובץ</span>
              <Input
                name="name"
                defaultValue={doc.name.replace(/\.[^.]*$/, "")}
                maxLength={MAX_NAME_LENGTH}
                required
                className="h-9 text-sm"
                dir="auto"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-ink-muted">סיווג</span>
              <Select name="category" defaultValue={doc.category ?? ""} className="h-9 text-sm">
                <option value="">ללא סיווג</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-ink-muted">תיאור קצר (לא חובה)</span>
            <Input
              name="description"
              defaultValue={doc.description ?? ""}
              maxLength={MAX_DESCRIPTION_LENGTH}
              className="h-9 text-sm"
              dir="auto"
            />
          </label>
          {error && <p className="text-sm text-terracotta-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "שומר…" : "שמירה"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
            >
              ביטול
            </Button>
          </div>
        </form>
      )}

      {mode === "delete" && (
        <div
          role="alertdialog"
          aria-label="מחיקת מסמך"
          className="mt-3 sm:ms-[3.25rem] sm:w-[26rem] rounded-xl border border-terracotta-500/30 bg-terracotta-500/5 px-4 py-3 space-y-2 text-sm"
        >
          <p className="font-medium text-ink">
            למחוק את ״<span dir="auto">{doc.name}</span>״?
          </p>
          <p className="text-ink-soft">
            הקובץ יימחק לצמיתות ולא יהיה אפשר לשחזר אותו. ייתכן שחלה עליך חובה לשמור
            מסמכים טיפוליים — ההחלטה שלך.
          </p>
          {error && <p className="text-terracotta-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="button" size="sm" variant="danger" disabled={pending} onClick={remove}>
              {pending ? "מוחק…" : "מחיקת המסמך"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setMode("idle");
                setError(null);
              }}
            >
              חזרה
            </Button>
          </div>
        </div>
      )}

      {mode === "idle" && error && <p className="mt-2 text-sm text-terracotta-600">{error}</p>}
    </li>
  );
}
