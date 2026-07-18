import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DesktopSidebar } from "@/components/nav/desktop-sidebar";
import { MobileTopBar } from "@/components/nav/mobile-top-bar";
import { MobileTabBar } from "@/components/nav/mobile-tab-bar";
import { BiometricLockOverlay } from "@/components/security/biometric-lock-overlay";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <BiometricLockOverlay />
      <DesktopSidebar userName={session.user.name} />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar userName={session.user.name} />
        <main className="flex-1">
          {/* pb-24 on mobile so content isn't hidden behind the bottom tab bar */}
          <div className="container-page py-6 lg:py-8 pb-24 lg:pb-8">
            {children}
          </div>
        </main>
        <MobileTabBar />
      </div>
    </div>
  );
}
