import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DesktopSidebar } from "@/components/nav/desktop-sidebar";
import { MobileTopBar } from "@/components/nav/mobile-top-bar";
import { MobileTabBar } from "@/components/nav/mobile-tab-bar";
import { BiometricLockOverlay } from "@/components/security/biometric-lock-overlay";
import { ClinicBanner } from "@/components/layout/clinic-banner";
import { SubscriptionBanner } from "@/components/layout/subscription-banner";
import { subscriptionStateFor } from "@/lib/subscription-server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sub = await subscriptionStateFor(session.user.id);
  const showBanner =
    sub.status === "expired" ||
    (sub.status === "trial" && (sub.daysLeft ?? 99) <= 7);

  return (
    <div className="min-h-screen flex">
      <BiometricLockOverlay />
      <DesktopSidebar userName={session.user.name} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar userName={session.user.name} />
        <main className="flex-1">
          {/* pb-28 on mobile so content isn't hidden behind the floating tab bar */}
          <div className="container-page py-6 lg:py-8 pb-28 lg:pb-8 animate-page">
            <ClinicBanner userName={session.user.name} />
            {showBanner && (
              <SubscriptionBanner
                status={sub.status as "trial" | "expired"}
                daysLeft={sub.daysLeft}
              />
            )}
            {children}
          </div>
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
