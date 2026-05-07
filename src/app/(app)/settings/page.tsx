import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BusinessInfoForm } from "@/components/settings/business-info-form";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      businessName: true,
      businessId: true,
      address: true,
      phone: true,
      defaultRate: true,
    },
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">הגדרות</h1>
        <p className="text-ink-muted text-sm mt-1">
          פרטים אישיים ועסקיים שמופיעים בחשבוניות.
        </p>
      </header>

      <BusinessInfoForm
        initial={{
          name: user.name,
          businessName: user.businessName,
          businessId: user.businessId,
          address: user.address,
          phone: user.phone,
          defaultRate: user.defaultRate ? user.defaultRate.toString() : null,
        }}
      />
    </div>
  );
}
