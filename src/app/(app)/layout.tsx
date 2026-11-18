import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DesktopSidebar } from "@/components/nav/desktop-sidebar";
import { MobileTopBar } from "@/components/nav/mobile-top-bar";
import { MobileTabBar } from "@/components/nav/mobile-tab-bar";
import { BiometricLockOverlay } from "@/components/security/biometric-lock-overlay";
import { IdleGuard } from "@/components/security/idle-guard";
import { HelpWidget } from "@/components/help/help-widget";
import { SkipLink } from "@/components/ui/skip-link";
import { normalizeIdleTimeout } from "@/lib/idle-timeout";
import { shouldEnterSetup } from "@/lib/onboarding";
import { ClinicBanner } from "@/components/layout/clinic-banner";
import { ClientWordProvider } from "@/components/layout/client-word";
import { ThemeStyle } from "@/components/layout/theme-style";
import { SubscriptionBanner } from "@/components/layout/subscription-banner";
import { subscriptionStateFor } from "@/lib/subscription-server";
import { db } from "@/lib/db";
import { documentsEnabled } from "@/lib/features";
import { countTasksDueNow } from "@/lib/tasks-data";
import { toZonedDateTimeLocal } from "@/lib/timezone";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [sub, taskCount, branding] = await Promise.all([
    subscriptionStateFor(session.user.id),
    // The number beside "משימות" in the menus: open tasks due today or earlier
    countTasksDueNow(session.user.id, toZonedDateTimeLocal(new Date()).slice(0, 10)),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        brandName: true,
        logoUrl: true,
        clinicType: true,
        colorTheme: true,
        clientWord: true,
        idleTimeoutMinutes: true,
        name: true,
        email: true,
        phone: true,
        onboardingCompletedAt: true,
        onboardingPausedAt: true,
        closedAt: true,
      },
    }),
  ]);
  // A closed account has only one page left: restore it, or take a copy
  if (branding?.closedAt) redirect("/account-closed");
  // A new account starts in the setup wizard (existing ones are marked done)
  if (branding && shouldEnterSetup(branding, sub.status)) redirect("/setup");
  // Income/expense documents are hidden until they can be issued (src/lib/features.ts)
  const documents = documentsEnabled();
  const brand = branding
    ? { brandName: branding.brandName, logoUrl: branding.logoUrl, clinicType: branding.clinicType }
    : undefined;
  const showBanner =
    sub.status === "expired" ||
    (sub.status === "trial" && (sub.daysLeft ?? 99) <= 7);

  return (
    <ClientWordProvider word={branding?.clientWord}>
    <div className="min-h-screen flex">
      <ThemeStyle theme={branding?.colorTheme} />
      <SkipLink />
      <BiometricLockOverlay />
      <IdleGuard
        idleMinutes={normalizeIdleTimeout(branding?.idleTimeoutMinutes)}
        authTime={session.authTime ?? null}
      />
      <DesktopSidebar
        userName={session.user.name}
        branding={brand}
        documents={documents}
        taskCount={taskCount}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar
          userName={session.user.name}
          branding={brand}
          documents={documents}
          taskCount={taskCount}
        />
        <main id="main-content" tabIndex={-1} className="flex-1">
          {/* pb-28 on mobile so content isn't hidden behind the floating tab bar */}
          <div className="container-page py-6 lg:py-8 pb-28 lg:pb-8 animate-page">
            <ClinicBanner userName={session.user.name} logoUrl={branding?.logoUrl} />
            {showBanner && (
              <SubscriptionBanner
                status={sub.status as "trial" | "expired"}
                daysLeft={sub.daysLeft}
              />
            )}
            {children}
          </div>
        </main>
        <MobileTabBar documents={documents} taskCount={taskCount} />
      </div>
      <HelpWidget
        documents={documents}
        user={{
          name: branding?.name ?? session.user.name ?? "",
          email: branding?.email ?? session.user.email ?? "",
          phone: branding?.phone ?? null,
        }}
      />
    </div>
    </ClientWordProvider>
  );
}
