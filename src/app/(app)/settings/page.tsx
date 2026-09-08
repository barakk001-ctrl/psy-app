import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import { MorningSettingsForm } from "@/components/settings/morning-settings-form";
import { BiometricSettings } from "@/components/settings/biometric-settings";
import { InboxSettings } from "@/components/settings/inbox-settings";
import { MeetingTypesCard } from "@/components/settings/meeting-types-card";
import { AuditLogCard } from "@/components/settings/audit-log-card";
import { TwoFactorSettings } from "@/components/settings/two-factor-settings";

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
      vatLiable: true,
      inboxToken: true,
      totpEnabled: true,
      totpBackupCodes: true,
      morningApiKeyId: true,
      morningApiSecret: true,
      morningSandbox: true,
      morningDocType: true,
    },
  });

  if (!user) return null;

  const meetingTypes = await db.meetingType.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, name: true, color: true },
  });

  const auditRows = await db.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const auditClientIds = [...new Set(auditRows.map((r) => r.clientId).filter(Boolean))] as string[];
  const auditClients = auditClientIds.length
    ? await db.client.findMany({
        where: { id: { in: auditClientIds }, userId },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const clientNames = Object.fromEntries(
    auditClients.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]),
  );
  const auditEntries = auditRows.map((r) => ({
    id: r.id,
    action: r.action,
    createdAt: r.createdAt,
    sessionId: r.sessionId,
    clientId: r.clientId,
    clientName: r.clientId ? (clientNames[r.clientId] ?? "(לקוח שנמחק)") : null,
  }));

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
          vatLiable: user.vatLiable,
        }}
      />

      <MeetingTypesCard types={meetingTypes} />

      <InboxSettings token={user.inboxToken} />

      <TwoFactorSettings
        enabled={user.totpEnabled}
        backupCount={
          user.totpBackupCodes ? (JSON.parse(user.totpBackupCodes) as string[]).length : 0
        }
      />

      <BiometricSettings userEmail={user.email} userName={user.name} />

      <AuditLogCard entries={auditEntries} />

      <MorningSettingsForm
        connected={morningConnected}
        keyIdMasked={keyIdMasked}
        sandbox={user.morningSandbox}
        docType={user.morningDocType}
      />
    </div>
  );
}
