import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { normalizeIdleTimeout } from "@/lib/idle-timeout";
import { stepToOpen } from "@/lib/onboarding";
import { READ_ONLY_PATH, subscriptionStateFor } from "@/lib/subscription-server";
import { BiometricLockOverlay } from "@/components/security/biometric-lock-overlay";
import { IdleGuard } from "@/components/security/idle-guard";
import { SetupWizard } from "@/components/setup/setup-wizard";
import { documentsEnabled } from "@/lib/features";

export const metadata = { title: "הגדרה ראשונית — מרפאה אישית" };
export const dynamic = "force-dynamic";

// The first-run wizard: outside the (app) layout, so it fills the screen like
// a phone app's onboarding. Also reachable any time from Settings.
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Read-only accounts stay under the write lock: nothing here could be saved
  const sub = await subscriptionStateFor(userId);
  if (!sub.writable) redirect(READ_ONLY_PATH);

  const [user, meetingTypes] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        brandName: true,
        logoUrl: true,
        logoOnDocuments: true,
        businessName: true,
        businessId: true,
        address: true,
        defaultRate: true,
        vatLiable: true,
        defaultSessionMinutes: true,
        idleTimeoutMinutes: true,
        onboardingStep: true,
      },
    }),
    db.meetingType.findMany({
      where: { userId },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    }),
  ]);
  if (!user) redirect("/login");

  const { step: stepParam } = await searchParams;
  const step = stepToOpen(stepParam, user.onboardingStep);
  return (
    <>
      <BiometricLockOverlay />
      <IdleGuard
        idleMinutes={normalizeIdleTimeout(user.idleTimeoutMinutes)}
        authTime={session.authTime ?? null}
      />
      <SetupWizard
        key={step}
        step={step}
        documents={documentsEnabled()}
        brand={{
          brandName: user.brandName,
          logoUrl: user.logoUrl,
          logoOnDocuments: user.logoOnDocuments,
        }}
        business={{
          businessName: user.businessName,
          businessId: user.businessId,
          address: user.address,
          defaultRate: user.defaultRate ? user.defaultRate.toString() : null,
          vatLiable: user.vatLiable,
        }}
        meetingTypes={meetingTypes}
        defaultMinutes={user.defaultSessionMinutes}
      />
    </>
  );
}
