import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import { PersonalDetailsForm } from "@/components/settings/personal-details-form";
import { MorningSettingsForm } from "@/components/settings/morning-settings-form";
import { BiometricSettings } from "@/components/settings/biometric-settings";
import { InboxSettings } from "@/components/settings/inbox-settings";
import { MeetingTypesCard } from "@/components/settings/meeting-types-card";
import { AuditLogCard } from "@/components/settings/audit-log-card";
import { CalendarFeedCard } from "@/components/settings/calendar-feed-card";
import { SubscriptionCard } from "@/components/settings/subscription-card";
import {
  AdminSubscriptionsCard,
  type AdminUserRow,
} from "@/components/settings/admin-subscriptions-card";
import { SUBSCRIPTION_FIELD_SELECT, getSubscriptionState } from "@/lib/subscription";
import { billingConfigured } from "@/lib/billing";
import { headers } from "next/headers";
import { TwoFactorSettings } from "@/components/settings/two-factor-settings";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; payerr?: string }>;
}) {
  const sp = await searchParams;
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
      calendarToken: true,
      calendarNameMode: true,
      ...SUBSCRIPTION_FIELD_SELECT,
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

  const subState = getSubscriptionState(user);
  const adminUsers: AdminUserRow[] = user.isAdmin
    ? await db.user.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, ...SUBSCRIPTION_FIELD_SELECT },
      })
    : [];

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

      <PersonalDetailsForm
        initial={{ name: user.name, email: user.email, phone: user.phone }}
      />

      <BusinessInfoForm
        initial={{
          businessName: user.businessName,
          businessId: user.businessId,
          address: user.address,
          defaultRate: user.defaultRate ? user.defaultRate.toString() : null,
          vatLiable: user.vatLiable,
        }}
      />

      <MeetingTypesCard types={meetingTypes} />

      <CalendarFeedCard
        token={user.calendarToken}
        mode={user.calendarNameMode}
        origin={await (async () => {
          const h = await headers();
          const proto = h.get("x-forwarded-proto") ?? "https";
          const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
          return `${proto}://${host}`;
        })()}
      />

      <InboxSettings token={user.inboxToken} />

      <TwoFactorSettings
        enabled={user.totpEnabled}
        backupCount={
          user.totpBackupCodes ? (JSON.parse(user.totpBackupCodes) as string[]).length : 0
        }
      />

      <BiometricSettings userEmail={user.email} userName={user.name} />

      <SubscriptionCard
        state={subState}
        cardPayments={billingConfigured()}
        notice={sp.payerr ?? (sp.paid === "1" ? "paid" : sp.paid === "0" ? "cancelled" : null)}
      />

      {user.isAdmin && <AdminSubscriptionsCard users={adminUsers} meId={userId} />}

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
