"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { idleSignOutAction } from "@/server/actions/auth";
import {
  HEARTBEAT_MS,
  clientAbsoluteDeadline,
  formatCountdown,
  idlePhase,
  type IdlePhase,
  type IdleReason,
} from "@/lib/idle-timeout";
import { dirtyWork, saveDirtyWork } from "@/lib/unsaved-work";

// Automatic sign-out after inactivity — the browser half (rules and the
// server half: src/lib/idle-timeout.ts).
//
// Activity in any tab counts for all of them: the last activity time lives in
// localStorage, and the other tabs read it every second (and on its `storage`
// event). While she's active, the server's clock is refreshed through
// /api/auth/session at most every HEARTBEAT_MS, so a long stretch of typing
// without saving never lets the server-side session lapse.
//
// Signing out: the page is covered at once, unsaved summaries are saved
// (useUnsavedWork), the session cookie is cleared, and /login is loaded with a
// full page load — nothing of the signed-in page stays in memory.

const KEY_ACTIVITY = "idle.lastActivity";
const KEY_PING = "idle.lastPing";
const KEY_LOGOUT = "idle.logout";
const KEY_SAVING_PREFIX = "idle.saving.";

/** Activity is written to localStorage at most this often (mousemove floods). */
const WRITE_EVERY_MS = 5_000;
/** How long a tab waits for another tab that is saving a summary. */
const SAVE_WAIT_MS = 12_000;

function readNum(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function writeNum(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // private mode / storage blocked — this tab still keeps its own timer
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Another tab is still saving a summary before the shared sign-out. */
function otherTabSaving(now: number): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_SAVING_PREFIX) && Number(localStorage.getItem(key)) > now) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function isStandalonePwa(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type LogoutReason = IdleReason | "manual";

export function IdleGuard({
  idleMinutes,
  authTime,
}: {
  idleMinutes: number;
  /** Sign-in time (ms), for the 12-hour limit; null if unknown */
  authTime: number | null;
}) {
  const [phase, setPhase] = useState<IdlePhase>({ kind: "active" });
  const [loggingOut, setLoggingOut] = useState<null | { saving: boolean }>(null);
  const [unsaved, setUnsaved] = useState<{ label: string; savable: boolean }[]>([]);

  const coverRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<() => void>(() => {});
  const logoutRef = useRef<(reason: LogoutReason) => void>(() => {});
  const dismissAbsoluteRef = useRef<() => void>(() => {});

  useEffect(() => {
    const absoluteDeadline = clientAbsoluteDeadline(authTime);
    const tabId = Math.random().toString(36).slice(2);
    let lastActivity = Date.now();
    let lastWrite = 0;
    let shown: IdlePhase = { kind: "active" };
    let absoluteDismissed = false;
    let leaving = false;

    const showCover = (show: boolean) => {
      if (coverRef.current) coverRef.current.style.display = show ? "flex" : "none";
    };

    const sharedLastActivity = () => Math.max(lastActivity, readNum(KEY_ACTIVITY) ?? 0);

    const show = (next: IdlePhase) => {
      const visible: IdlePhase =
        next.kind === "warning" && next.reason === "absolute" && absoluteDismissed
          ? { kind: "active" }
          : next;
      const changed =
        visible.kind !== shown.kind ||
        (visible.kind === "warning" &&
          shown.kind === "warning" &&
          (visible.reason !== shown.reason ||
            Math.ceil(visible.msLeft / 1000) !== Math.ceil(shown.msLeft / 1000)));
      if (visible.kind === "warning" && shown.kind !== "warning") {
        setUnsaved(dirtyWork().map((w) => ({ label: w.label, savable: !!w.save })));
      }
      shown = visible;
      if (changed) setPhase(visible);
    };

    /** Re-reads the clock; signs out when time is up. False once signed out. */
    const evaluate = (): boolean => {
      if (leaving) return false;
      const p = idlePhase({
        now: Date.now(),
        lastActivity: sharedLastActivity(),
        idleMinutes,
        absoluteDeadline,
      });
      if (p.kind === "expired") {
        void logout(p.reason);
        return false;
      }
      show(p);
      return true;
    };

    const ping = () => {
      writeNum(KEY_PING, Date.now());
      fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : undefined))
        .then((s: { user?: { id?: string } | null } | null | undefined) => {
          // A definite answer without a user: the server already ended it.
          if (s !== undefined && !s?.user?.id) void logout("idle", { serverGone: true });
        })
        .catch(() => {
          // offline — the next activity tries again
        });
    };

    const recordActivity = (opts: { explicit?: boolean } = {}) => {
      // First the clock as it stands: a laptop waking from sleep fires a
      // mousemove before the timer runs, and that must not count as activity.
      if (!evaluate()) return;
      // The warning wants a deliberate "המשך": a mouse drifting over it
      // shouldn't silently cancel it.
      if (!opts.explicit && shown.kind === "warning" && shown.reason === "idle") return;
      const now = Date.now();
      lastActivity = now;
      if (opts.explicit || now - lastWrite > WRITE_EVERY_MS) {
        lastWrite = now;
        writeNum(KEY_ACTIVITY, now);
      }
      if (opts.explicit || now - (readNum(KEY_PING) ?? 0) > HEARTBEAT_MS) ping();
      evaluate();
    };

    const logout = async (
      reason: LogoutReason,
      opts: { fromOtherTab?: boolean; serverGone?: boolean } = {},
    ) => {
      if (leaving) return;
      leaving = true;
      showCover(true);
      const mine = opts.serverGone ? [] : dirtyWork().filter((w) => w.save);
      setLoggingOut({ saving: mine.length > 0 });
      if (!opts.fromOtherTab) writeNum(KEY_LOGOUT, Date.now());

      if (mine.length > 0) {
        writeNum(KEY_SAVING_PREFIX + tabId, Date.now() + SAVE_WAIT_MS);
        await saveDirtyWork(SAVE_WAIT_MS - 2_000);
        removeKey(KEY_SAVING_PREFIX + tabId);
      } else {
        // give another tab a moment to start saving its own summary
        await sleep(1_500);
      }
      const giveUp = Date.now() + SAVE_WAIT_MS;
      while (otherTabSaving(Date.now()) && Date.now() < giveUp) await sleep(300);

      try {
        await idleSignOutAction();
      } catch {
        // already signed out (another tab, or the server's own expiry)
      }
      window.location.replace(reason === "manual" ? "/login" : `/login?reason=${reason}`);
    };

    continueRef.current = () => recordActivity({ explicit: true });
    logoutRef.current = (reason) => void logout(reason);
    dismissAbsoluteRef.current = () => {
      absoluteDismissed = true;
      evaluate();
    };

    // This page was just served, so the server counted it as activity.
    writeNum(KEY_ACTIVITY, lastActivity);
    writeNum(KEY_PING, lastActivity);
    lastWrite = lastActivity;

    // pointermove/scroll fire many times a second; once a second is plenty.
    let lastEvent = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastEvent < 1_000) return;
      lastEvent = now;
      recordActivity();
    };
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        // In the installed app the screen shot in the app switcher, and the
        // first frame on return, would show the last page — cover it.
        if (isStandalonePwa()) showCover(true);
        return;
      }
      if (evaluate()) {
        showCover(false);
        recordActivity();
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) onVisible();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_LOGOUT && e.newValue) void logout("idle", { fromOtherTab: true });
      else if (e.key === KEY_ACTIVITY) evaluate();
    };

    const activityEvents = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "input"] as const;
    for (const type of activityEvents) {
      window.addEventListener(type, onActivity, { passive: true, capture: true });
    }
    // scroll doesn't bubble — capture catches scrolling inside any element
    document.addEventListener("scroll", onActivity, { passive: true, capture: true });
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(evaluate, 1_000);

    return () => {
      for (const type of activityEvents) {
        window.removeEventListener(type, onActivity, { capture: true });
      }
      document.removeEventListener("scroll", onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [idleMinutes, authTime]);

  const warning = !loggingOut && phase.kind === "warning" ? phase : null;

  return (
    <>
      {/* Covers the page while signing out, and (installed app) while hidden. */}
      <div
        ref={coverRef}
        // Shown through the ref as well (synchronously, from event handlers);
        // React only rewrites `display` when `loggingOut` changes.
        style={{ display: loggingOut ? "flex" : "none" }}
        className="fixed inset-0 z-[110] bg-cream-50 flex-col items-center justify-center gap-4 px-6 text-center"
        aria-hidden={!loggingOut}
      >
        <div className="w-16 h-16 rounded-2xl bg-sage-600 text-cream-50 flex items-center justify-center font-display text-3xl">
          מ
        </div>
        {loggingOut && (
          <p className="text-sm text-ink-muted" role="status">
            {loggingOut.saving ? "שומר את הסיכום ומתנתק…" : "מתנתק…"}
          </p>
        )}
      </div>

      {warning && (
        <div
          className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-3 sm:p-6"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="idle-title"
          aria-describedby="idle-text"
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" aria-hidden />
          <div className="relative w-full max-w-md glass rounded-3xl border border-cream-200/80 shadow-lift p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sage-50 border border-sage-100 text-sage-700 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <h2 id="idle-title" className="font-display text-2xl text-ink">
                {warning.reason === "idle" ? "עדיין כאן?" : "יש להתחבר מחדש"}
              </h2>
            </div>

            <p id="idle-text" className="text-ink leading-relaxed">
              {warning.reason === "idle" ? (
                <>
                  המערכת תתנתק בעוד{" "}
                  <span dir="ltr" className="font-semibold tabular-nums">
                    {formatCountdown(warning.msLeft)}
                  </span>{" "}
                  עקב חוסר פעילות.
                </>
              ) : (
                <>
                  מטעמי אבטחה יש להתחבר מחדש אחרי 12 שעות. המערכת תתנתק בעוד{" "}
                  <span dir="ltr" className="font-semibold tabular-nums">
                    {formatCountdown(warning.msLeft)}
                  </span>
                  .
                </>
              )}
            </p>

            {unsaved.length > 0 && (
              <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-4 py-3 text-sm text-ink leading-relaxed">
                {unsaved.map((w) => (
                  <p key={w.label}>
                    יש {w.label} שלא נשמר.{" "}
                    {w.savable
                      ? "אם המערכת תתנתק, הוא יישמר אוטומטית לפני הניתוק."
                      : "אם המערכת תתנתק, השינויים יאבדו."}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {warning.reason === "idle" ? (
                <Button type="button" autoFocus onClick={() => continueRef.current()}>
                  המשך
                </Button>
              ) : (
                <Button type="button" autoFocus onClick={() => dismissAbsoluteRef.current()}>
                  סגירה
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => logoutRef.current("manual")}>
                <LogOut className="w-4 h-4" />
                {warning.reason === "idle" ? "התנתק" : "התחברות מחדש עכשיו"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
