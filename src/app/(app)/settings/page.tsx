import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import { MorningSettingsForm } from "@/components/settings/morning-settings-form";
import { BiometricSettings } from "@/components/settings/biometric-settings";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      businessName: true,
      businessId: true,
      address: true,
      phone: true,
      defaultRate: true,
      morningApiKeyId: true,
      morningApiSecret: true,
      morningSandbox: true,
      morningDocType: true,
    },
  });

  if (!user) return null;

  const morningConnected = !!(user.morningApiKeyId && user.morningApiSecret);
  const keyIdMasked = user.morningApiKeyId
    ? `…${user.morningApiKeyId.slice(-6)}`
    : null;

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

      <BiometricSettings userEmail={user.email} userName={user.name} />

      <MorningSettingsForm
        connected={morningConnected}
        keyIdMasked={keyIdMasked}
        sandbox={user.morningSandbox}
        docType={user.morningDocType}
      />
    </div>
  );
}
