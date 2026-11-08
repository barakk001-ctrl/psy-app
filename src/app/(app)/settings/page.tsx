import Link from "next/link";
import { auth } from "@/auth";
import { db, dbAll } from "@/lib/db";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import { BrandingCard } from "@/components/settings/branding-card";
import { PersonalDetailsForm } from "@/components/settings/personal-details-form";
import { DocumentDefaultsCard } from "@/components/settings/document-defaults-card";
import { creatableKinds, documentDefaults } from "@/lib/billing-docs";
import { DocumentLookCard } from "@/components/settings/document-look-card";
import { DocumentEmailCard } from "@/components/settings/document-email-card";
import { DocumentNumberingCard } from "@/components/settings/document-numbering-card";
import { docLook, emailTexts } from "@/lib/document-look";
import { DOC_BUSINESS_SELECT, docBusiness } from "@/lib/document-business";
import { clinicDay } from "@/lib/billing-doc-data";
import { BiometricSettings } from "@/components/settings/biometric-settings";
import { InboxSettings } from "@/components/settings/inbox-settings";
import { MeetingTypesCard } from "@/components/settings/meeting-types-card";
import { ChangePasswordCard } from "@/components/settings/change-password-card";
import { AuditLogCard } from "@/components/settings/audit-log-card";
import { CalendarFeedCard } from "@/components/settings/calendar-feed-card";
import { SubscriptionCard } from "@/components/settings/subscription-card";
import {
  AdminSubscriptionsCard,
  type AdminUserRow,
} from "@/components/settings/admin-subscriptions-card";
import {
  AdminSupportRequestsCard,
  type AdminSupportRow,
} from "@/components/settings/admin-support-requests-card";
import { AdminInvitesCard, type AdminInviteRow } from "@/components/settings/admin-invites-card";
import { canonicalOrigin, originFromHeaders } from "@/lib/request-origin";
import { SUBSCRIPTION_FIELD_SELECT, getSubscriptionState } from "@/lib/subscription";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { TwoFactorSettings } from "@/components/settings/two-factor-settings";
import { IdleTimeoutCard } from "@/components/settings/idle-timeout-card";
import { normalizeIdleTimeout } from "@/lib/idle-timeout";
import { AccountExportCard } from "@/components/settings/account-export-card";
import { AccountClosureCard } from "@/components/settings/account-closure-card";
import { AdminPendingClosuresCard } from "@/components/settings/admin-pending-closures-card";
import { pendingClosures } from "@/lib/account-closure-data";
import { reauthMethod } from "@/lib/reauth";
import { ViewTabs } from "@/components/ui/view-tabs";
import {
  parseSettingsTab,
  settingsHref,
  settingsTabs,
  type SettingsTabKey,
} from "@/lib/settings-tabs";

export const metadata = { title: "הגדרות — מרפאה אישית" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; payerr?: string; export?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  // Payment results used to land here; the plans page shows them now
  if (sp.paid || sp.payerr) {
    const q = new URLSearchParams();
    if (sp.paid) q.set("paid", sp.paid);
    if (sp.payerr) q.set("payerr", sp.payerr);
    redirect(`/subscription?${q}`);
  }
  const session = await auth();
  const userId = session!.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      ...DOC_BUSINESS_SELECT,
      name: true,
      email: true,
      businessName: true,
      brandName: true,
      logoUrl: true,
      logoOnDocuments: true,
      businessId: true,
      address: true,
      phone: true,
      defaultRate: true,
      vatLiable: true,
      defaultSessionMinutes: true,
      inboxToken: true,
      inboxApiToken: true,
      totpEnabled: true,
      totpSecret: true,
      totpBackupCodes: true,
      hashedPassword: true,
      defaultDocType: true,
      businessNameEn: true,
      addressEn: true,
      descriptionEn: true,
      docEmailSubject: true,
      docEmailBody: true,
      docNextTaxInvoice: true,
      docNextTaxInvoiceReceipt: true,
      docNextReceipt: true,
      docNextCreditNote: true,
      docCurrency: true,
      docLang: true,
      docVatType: true,
      docRounding: true,
      calendarToken: true,
      calendarNameMode: true,
      idleTimeoutMinutes: true,
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
  // dbAll: clients in the recycle bin are still named here (until purged)
  const auditClients = auditClientIds.length
    ? await dbAll.client.findMany({
        where: { id: { in: auditClientIds }, userId },
        select: { id: true, firstName: true, lastName: true, deletedAt: true },
      })
    : [];
  const auditClientById = new Map(auditClients.map((c) => [c.id, c]));
  const auditEntries = auditRows.map((r) => {
    const c = r.clientId ? auditClientById.get(r.clientId) : undefined;
    const name = c ? `${c.firstName} ${c.lastName}`.trim() : null;
    return {
      id: r.id,
      action: r.action,
      createdAt: r.createdAt,
      sessionId: r.sessionId,
      clientId: r.clientId,
      clientName: !r.clientId
        ? null
        : !c
          ? "(לקוח שנמחק)"
          : c.deletedAt
            ? `${name} (בסל המחזור)`
            : name,
      clientHref: !c ? null : c.deletedAt ? "/clients?view=trash" : `/clients/${c.id}`,
    };
  });

  const subState = getSubscriptionState(user);
  const adminUsers: AdminUserRow[] = user.isAdmin
    ? await db.user.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, ...SUBSCRIPTION_FIELD_SELECT },
      })
    : [];
  const adminInvites: AdminInviteRow[] = user.isAdmin
    ? await db.inviteCode.findMany({ orderBy: { createdAt: "desc" }, take: 50 })
    : [];
  const inviteOrigin = canonicalOrigin() ?? originFromHeaders(await headers()) ?? "";
  const supportRequests: AdminSupportRow[] = user.isAdmin
    ? (
        await db.supportRequest.findMany({
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            subject: true,
            message: true,
            pagePath: true,
            attachmentName: true,
            emailStatus: true,
            status: true,
            createdAt: true,
          },
        })
      ).map(({ attachmentName, ...r }) => ({ ...r, hasAttachment: !!attachmentName }))
    : [];

  const closures = user.isAdmin ? await pendingClosures() : [];

  const calendarOrigin = await (async () => {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    return `${proto}://${host}`;
  })();

  // Each card sits under one tab. Links to a card's anchor (/settings#meeting-types)
  // open its tab; SETTINGS_TABS (src/lib/settings-tabs.ts) names them.
  const panels: Record<SettingsTabKey, React.ReactNode> = {
    personal: (
      <>
        <Link
          href="/setup?step=1"
          className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700"
        >
          <span>
            <span className="font-medium">הגדרה ראשונית</span>
            <span className="block text-xs text-sage-700/80">
              מעבר צעד אחר צעד על השם, פרטי העסק וסוגי המפגשים
            </span>
          </span>
          <span aria-hidden>←</span>
        </Link>
        <PersonalDetailsForm initial={{ name: user.name, email: user.email }} />
      </>
    ),
    business: (
      <>
        <div id="business" className="scroll-mt-24">
          <BusinessInfoForm
            full
            initial={{
              businessName: user.businessName,
              businessId: user.businessId,
              address: user.address,
              defaultRate: user.defaultRate ? user.defaultRate.toString() : null,
              vatLiable: user.vatLiable,
              occupation: user.occupation,
              businessDescription: user.businessDescription,
              phone: user.phone,
              docEmail: user.docEmail,
              website: user.website,
              businessNameEn: user.businessNameEn,
              addressEn: user.addressEn,
              descriptionEn: user.descriptionEn,
            }}
          />
        </div>
        <div id="branding" className="scroll-mt-24">
          <BrandingCard
            initial={{
              brandName: user.brandName,
              logoUrl: user.logoUrl,
              logoOnDocuments: user.logoOnDocuments,
            }}
          />
        </div>
      </>
    ),
    documents: (
      <>
        <div id="document-defaults" className="scroll-mt-24">
          <DocumentDefaultsCard
            defaults={documentDefaults(user)}
            vatLiable={user.vatLiable}
            defaultDocType={user.defaultDocType}
          />
        </div>
        <div id="document-look" className="scroll-mt-24">
          <DocumentLookCard
            business={docBusiness(user)}
            look={docLook(user)}
            logoUrl={user.logoUrl}
            logoOnDocuments={user.logoOnDocuments}
            today={clinicDay(new Date())}
          />
        </div>
        <div id="document-email" className="scroll-mt-24">
          <DocumentEmailCard {...emailTexts(user)} businessName={user.businessName || user.name} />
        </div>
        <div id="document-numbering" className="scroll-mt-24">
          <DocumentNumberingCard
            kinds={creatableKinds(user.vatLiable).map((k) => k.kind)}
            numbers={{
              TAX_INVOICE: user.docNextTaxInvoice,
              TAX_INVOICE_RECEIPT: user.docNextTaxInvoiceReceipt,
              RECEIPT: user.docNextReceipt,
              CREDIT_NOTE: user.docNextCreditNote,
            }}
          />
        </div>
      </>
    ),
    calendar: (
      <>
        {/* the calendar links here: /settings?tab=calendar#meeting-types */}
        <div id="meeting-types" className="scroll-mt-24">
          <MeetingTypesCard types={meetingTypes} defaultMinutes={user.defaultSessionMinutes} />
        </div>
        <CalendarFeedCard token={user.calendarToken} mode={user.calendarNameMode} origin={calendarOrigin} />
        <InboxSettings token={user.inboxToken} apiToken={user.inboxApiToken} />
      </>
    ),
    security: (
      <>
        <ChangePasswordCard hasPassword={!!user.hashedPassword} email={user.email} />
        <TwoFactorSettings
          enabled={user.totpEnabled}
          backupCount={
            user.totpBackupCodes ? (JSON.parse(user.totpBackupCodes) as string[]).length : 0
          }
        />
        <IdleTimeoutCard minutes={normalizeIdleTimeout(user.idleTimeoutMinutes)} />
        <BiometricSettings userEmail={user.email} userName={user.name} />
        <div id="audit-log" className="scroll-mt-24">
          <AuditLogCard entries={auditEntries} />
        </div>
        <div id="subscription" className="scroll-mt-24">
          <SubscriptionCard state={subState} />
        </div>
        <div id="account-data" className="scroll-mt-24">
          <AccountExportCard method={reauthMethod(user)} email={user.email} message={sp.export} />
        </div>
        <AccountClosureCard method={reauthMethod(user)} email={user.email} isAdmin={user.isAdmin} />
      </>
    ),
    admin: user.isAdmin ? (
      <>
        <AdminSubscriptionsCard users={adminUsers} meId={userId} />
        <AdminInvitesCard invites={adminInvites} origin={inviteOrigin} />
        <AdminSupportRequestsCard requests={supportRequests} />
        <AdminPendingClosuresCard rows={closures} now={new Date()} />
      </>
    ) : null,
  };

  const tabs = settingsTabs(user.isAdmin).map((t) => ({
    key: t.key,
    label: t.label,
    href: settingsHref(t.key),
    panel: panels[t.key],
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl text-ink">הגדרות</h1>
        <p className="text-ink-muted text-sm mt-1">
          הפרטים שלך ושל העסק, מסמכים, יומן ופגישות, אבטחה וחשבון.
        </p>
      </header>

      <ViewTabs
        tabs={tabs}
        active={parseSettingsTab(sp.tab, user.isAdmin)}
        param="tab"
        scroll
        label="אזורי ההגדרות"
      />
    </div>
  );
}
