import { redirect } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccountExportCard } from "@/components/settings/account-export-card";
import { LogoMark } from "@/components/brand/logo-mark";
import { IdleGuard } from "@/components/security/idle-guard";
import { CLOSURE_WARNING, canRestore, closureDaysLeft } from "@/lib/account-closure";
import { daysLeftText } from "@/lib/client-trash";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { normalizeIdleTimeout } from "@/lib/idle-timeout";
import { reauthMethod } from "@/lib/reauth";
import { restoreAccountAction } from "@/server/actions/account";
import { signOutAction } from "@/server/actions/auth";

export const metadata = { title: "החשבון סגור — מרפאה אישית" };
export const dynamic = "force-dynamic";

// Where a closed account lands after signing in (the (app) layout sends it
// here): restore it, or take a copy. Outside the (app) layout: nothing else of
// the app is reachable from a closed account.
export default async function AccountClosedPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      closedAt: true,
      purgeAfter: true,
      isAdmin: true,
      hashedPassword: true,
      totpEnabled: true,
      totpSecret: true,
      idleTimeoutMinutes: true,
    },
  });
  if (!me?.closedAt) redirect("/dashboard");

  const now = new Date();
  const restorable = canRestore(me, now);

  return (
    <div className="min-h-screen px-4 py-10">
      <IdleGuard
        idleMinutes={normalizeIdleTimeout(me.idleTimeoutMinutes)}
        authTime={session.authTime ?? null}
      />
      <main className="mx-auto w-full max-w-xl space-y-6">
        <div className="flex justify-center">
          <LogoMark size={48} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>החשבון סגור</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {restorable ? (
              <>
                <p className="text-sm text-ink-soft leading-relaxed">
                  החשבון נסגר ב-{formatDate(me.closedAt)}. כל המידע יימחק לצמיתות ב-
                  {formatDate(me.purgeAfter)} ({daysLeftText(closureDaysLeft(me.purgeAfter!, now))}). עד אז
                  אפשר לשחזר את החשבון כפי שהיה.
                </p>
                <form action={restoreAccountAction}>
                  <Button type="submit">
                    <RotateCcw className="w-4 h-4" />
                    שחזור החשבון
                  </Button>
                </form>
              </>
            ) : (
              <p className="text-sm text-ink-soft leading-relaxed">
                תקופת השחזור הסתיימה, וכל המידע יימחק בקרוב.
              </p>
            )}
            <p className="text-xs text-ink-muted leading-relaxed">{CLOSURE_WARNING}</p>
          </CardContent>
        </Card>

        <AccountExportCard method={reauthMethod(me)} email={me.email} />

        <form action={signOutAction} className="text-center">
          <Button type="submit" variant="ghost" size="sm">
            יציאה
          </Button>
        </form>
      </main>
    </div>
  );
}
