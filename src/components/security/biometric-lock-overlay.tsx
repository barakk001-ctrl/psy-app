"use client";

import { useEffect, useRef, useState } from "react";
import { ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";
import {
  clearBioLock,
  isBioLockEnabled,
  isUnlockedThisSession,
  markUnlocked,
  verifyBioLock,
} from "@/lib/biometric";

type LockState = "checking" | "locked" | "open";

export function BiometricLockOverlay() {
  const [state, setState] = useState<LockState>("checking");
  const [failed, setFailed] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!isBioLockEnabled() || isUnlockedThisSession()) {
      setState("open");
      return;
    }
    setState("locked");
  }, []);

  useEffect(() => {
    if (state !== "locked" || attempted.current) return;
    attempted.current = true;
    void attemptUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  async function attemptUnlock() {
    setFailed(false);
    const ok = await verifyBioLock();
    if (ok) {
      markUnlocked();
      setState("open");
    } else {
      setFailed(true);
    }
  }

  if (state === "open") return null;

  return (
    <div className="fixed inset-0 z-[100] bg-cream-50 flex flex-col items-center justify-center gap-6 px-6 text-center">
      {state === "locked" && (
        <>
          <div className="w-16 h-16 rounded-2xl bg-sage-600 text-cream-50 flex items-center justify-center font-display text-3xl">
            מ
          </div>
          <div>
            <h1 className="font-display text-2xl text-ink">מרפאה נעולה</h1>
            <p className="text-sm text-ink-muted mt-1">
              יש לאמת את הזהות כדי להמשיך
            </p>
          </div>
          <Button onClick={attemptUnlock} size="lg">
            <ScanFace className="w-5 h-5" />
            פתיחה עם Face ID
          </Button>
          {failed && (
            <p className="text-sm text-terracotta-600">
              האימות לא הצליח — אפשר לנסות שוב.
            </p>
          )}
          <form
            action={signOutAction}
            onSubmit={() => {
              // Password re-login is the fallback — release the device lock
              clearBioLock();
            }}
          >
            <button
              type="submit"
              className="text-xs text-ink-muted underline hover:text-ink"
            >
              לא מצליח/ה? התנתקות וכניסה מחדש עם סיסמה
            </button>
          </form>
        </>
      )}
    </div>
  );
}
