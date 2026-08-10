"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, FileText, Trash2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  deleteSessionFileAction,
  uploadSessionFileAction,
} from "@/server/actions/files";

export type SessionFileItem = {
  id: string;
  fileName: string;
  size: number;
  createdAt: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function SessionFilesCard({
  sessionId,
  files,
}: {
  sessionId: string;
  files: SessionFileItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("sessionId", sessionId);
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadSessionFileAction(null, fd);
      if (res?.error) setError(res.error);
      router.refresh();
    });
  }

  function remove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteSessionFileAction(fd);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>מסמכים</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            upload(e.dataTransfer.files);
          }}
          className={cn(
            "w-full rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            dragOver
              ? "border-sage-500 bg-sage-50"
              : "border-cream-300 hover:border-sage-300 bg-cream-100/50",
          )}
        >
          <CloudUpload className="w-7 h-7 mx-auto text-sage-600 mb-2" />
          <span className="block text-sm text-ink-soft">
            {pending ? "מעלה…" : "גרירת קובץ לכאן או לחיצה לבחירה"}
          </span>
          <span className="block text-xs text-ink-subtle mt-1">
            עד 10MB · נשמר מוצפן
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="application/pdf,image/*,.doc,.docx,.txt"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />

        {error && <p className="text-sm text-terracotta-600">{error}</p>}

        {files.length > 0 && (
          <ul className="divide-y divide-cream-200">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2.5">
                <FileText className="w-4 h-4 text-sage-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={`/api/files/${f.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-ink hover:text-sage-700 truncate inline-flex items-center gap-1.5 max-w-full"
                  >
                    <span className="truncate">{f.fileName}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  <div className="text-xs text-ink-subtle">
                    {formatSize(f.size)} ·{" "}
                    {new Intl.DateTimeFormat("he-IL", {
                      dateStyle: "short",
                      timeZone: "Asia/Jerusalem",
                    }).format(new Date(f.createdAt))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  aria-label={`מחיקת ${f.fileName}`}
                  className="p-1.5 text-ink-subtle hover:text-terracotta-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
