import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <Sidebar userName={session.user.name} />
      <div className="flex-1 min-w-0">
        <div className="container-page py-8">{children}</div>
      </div>
    </div>
  );
}
