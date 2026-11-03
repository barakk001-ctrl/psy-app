// The cross-practice attack on every server action and API route that takes an
// id or a token. isolation.db.test.ts runs each one three ways:
//   - as practice B on practice A's ids: A's data must not change and nothing
//     of A's may come back (no canary text, 401/403/404 from a route);
//   - as a guest (no session, or a 2FA-pending one): the same;
//   - as A on A's own ids: it must really work. That control keeps a case
//     honest: a typo'd field name would otherwise "pass" by being refused.
//
// isolation-coverage.test.ts (no database needed) fails when an action or a
// route is on neither CASES/ROUTE_CASES nor the lists of things that take no
// id, so a new one can't ship without a case here.

import { PDF_BYTES, firstMeetingAt, type Practice } from "./db-fixtures";
import { form } from "./db-harness";

/** Runs an exported action by its "file.name" key. */
export type Call = (key: string, ...args: unknown[]) => Promise<unknown>;
/** Calls a route's handler (GET by default) and resolves to its Response. */
export type Hit = (
  key: string,
  url: string,
  opts?: {
    params?: Record<string, string>;
    method?: "GET" | "POST";
    body?: string;
    headers?: Record<string, string>;
  },
) => Promise<Response>;

export type Mode = "attack" | "control";

export type Ctx = {
  call: Call;
  hit: Hit;
  /** The practice whose ids are aimed at. */
  target: Practice;
  /** The acting practice (B in an attack, A in the control). */
  me: Practice;
  mode: Mode;
};

/**
 * What the owner's own call must do: "writes" = their data changed, "reads" =
 * their canary came back, a function = a custom check of the result.
 */
export type Control = "writes" | "reads" | ((result: unknown) => boolean);

export type Case = {
  run(ctx: Ctx): Promise<unknown>;
  control: Control;
  /** Operator actions: the control runs as the admin, the attack as B */
  admin?: true;
};

const has = (field: string) => (r: unknown) => !!(r as Record<string, unknown> | null)?.[field];
const okResponse = (r: unknown) => r instanceof Response && r.status === 200;

/** A valid "מסמך חדש" draft; each attack swaps in one foreign id. */
function documentJson(p: {
  clientId: string;
  sessionId?: string;
  relatedInvoiceId?: string;
  kind?: string;
  draftId?: string;
}) {
  const receipt = p.kind === "RECEIPT";
  return JSON.stringify({
    kind: p.kind ?? "TAX_INVOICE_RECEIPT",
    clientId: p.clientId,
    clientName: "שם על מסמך",
    date: "2026-11-01",
    sessionIds: p.sessionId ? [p.sessionId] : [],
    draftId: p.draftId ?? "",
    vatIncluded: true,
    items: receipt
      ? []
      : [
          {
            description: "פגישה",
            quantity: 1,
            unitPrice: "100",
          },
        ],
    payments: [{ method: "CASH", date: "2026-11-01", amount: "100" }],
    ...(p.relatedInvoiceId ? { relatedInvoiceId: p.relatedInvoiceId } : {}),
  });
}

const sessionForm = (id: string, clientId: string) =>
  form({ id, clientId, startsAt: "2030-03-05T10:00", durationMinutes: "50", location: "OFFICE" });

const quickEdit = (id: string, clientId: string) =>
  form({ id, clientId, date: "2030-03-05", startTime: "10:00", endTime: "10:50" });

const PDF = () => new File([PDF_BYTES], "new.pdf", { type: "application/pdf" });

/** Clinic wall-clock "yyyy-MM-ddTHH:mm" of the practices' first meeting + n hours. */
function firstMeetingLocal(plusHours: number): string {
  const d = new Date(firstMeetingAt().getTime() + plusHours * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const CASES: Record<string, Case> = {
  // ── clients ──────────────────────────────────────────────────────────────
  "clients.createClientAction": {
    // A waiting-list entry leaves the list when its person becomes a client
    run: ({ call, target }) =>
      call(
        "clients.createClientAction",
        null,
        form({ firstName: "חדש", lastName: "חדש", waitlistId: target.waitlistId }),
      ),
    control: "writes",
  },
  "clients.updateClientAction": {
    run: ({ call, target }) =>
      call("clients.updateClientAction", null, form({ id: target.clientId, firstName: "שונה", lastName: "שונה" })),
    control: "writes",
  },
  "clients.setClientStatusAction": {
    run: ({ call, target }) =>
      call("clients.setClientStatusAction", form({ id: target.inactiveClientId, status: "ACTIVE" })),
    control: "writes",
  },
  "clients.clientDeletionPreviewAction": {
    run: async ({ call, target }) => [
      await call("clients.clientDeletionPreviewAction", target.inactiveClientId),
      await call("clients.clientDeletionPreviewAction", target.trashedClientId, true),
    ],
    control: "reads",
  },
  "clients.trashClientAction": {
    run: ({ call, target }) => call("clients.trashClientAction", form({ id: target.inactiveClientId })),
    control: "writes",
  },
  "clients.restoreClientAction": {
    run: ({ call, target }) => call("clients.restoreClientAction", form({ id: target.trashedClientId })),
    control: "writes",
  },
  "clients.purgeClientNowAction": {
    run: ({ call, target }) => call("clients.purgeClientNowAction", form({ id: target.trashedClientId })),
    control: "writes",
  },

  // ── client documents and meeting files (uploads) ─────────────────────────
  "client-documents.uploadClientDocumentAction": {
    run: ({ call, target }) =>
      call("client-documents.uploadClientDocumentAction", form({ clientId: target.clientId, file: PDF() })),
    control: "writes",
  },
  "client-documents.updateClientDocumentAction": {
    run: ({ call, target }) =>
      call("client-documents.updateClientDocumentAction", form({ id: target.documentId, name: "שם חדש" })),
    control: "writes",
  },
  "client-documents.deleteClientDocumentAction": {
    run: ({ call, target }) =>
      call("client-documents.deleteClientDocumentAction", form({ id: target.documentId })),
    control: "writes",
  },
  "files.uploadSessionFileAction": {
    run: ({ call, target }) =>
      call("files.uploadSessionFileAction", null, form({ sessionId: target.sessionId, file: PDF() })),
    control: "writes",
  },
  "files.deleteSessionFileAction": {
    run: ({ call, target }) => call("files.deleteSessionFileAction", form({ id: target.fileId })),
    control: "writes",
  },

  // ── מסמכי הוצאות ─────────────────────────────────────────────────────────
  "expenses.saveExpenseAction": {
    run: ({ call, target }) =>
      call(
        "expenses.saveExpenseAction",
        form({ id: target.expenseId, intent: "draft", supplier: "ספק אחר", amount: "1" }),
      ),
    control: "writes",
  },
  "expenses.deleteExpenseAction": {
    run: ({ call, target }) => call("expenses.deleteExpenseAction", form({ id: target.expenseId })),
    control: "writes",
  },

  // ── "מסמך חדש" and morning documents ─────────────────────────────────────
  "documents.saveDocumentAction": {
    run: async ({ call, target, me, mode }) => {
      const save = "documents.saveDocumentAction";
      if (mode === "control") {
        return call(save, documentJson({ clientId: me.clientId, sessionId: me.pastSessionId }), "draft");
      }
      return [
        // their client
        await call(save, documentJson({ clientId: target.clientId }), "draft"),
        // my client, their meeting
        await call(save, documentJson({ clientId: me.clientId, sessionId: target.pastSessionId }), "draft"),
        // a receipt paying their invoice
        await call(
          save,
          documentJson({ clientId: me.clientId, relatedInvoiceId: target.issuedDocId, kind: "RECEIPT" }),
          "issue",
        ),
        // a credit note cancelling their invoice
        await call(
          save,
          documentJson({ clientId: me.clientId, relatedInvoiceId: target.issuedDocId, kind: "CREDIT_NOTE" }),
          "issue",
        ),
        // my client, written over their saved draft
        await call(save, documentJson({ clientId: me.clientId, draftId: target.draftDocId }), "draft"),
      ];
    },
    control: "writes",
  },
  "documents.previewDraftInMorningAction": {
    run: ({ call, target }) =>
      call("documents.previewDraftInMorningAction", documentJson({ clientId: target.clientId })),
    control: has("pdfBase64"),
  },
  "documents.previewStoredInMorningAction": {
    run: ({ call, target }) => call("documents.previewStoredInMorningAction", target.draftDocId),
    control: has("pdfBase64"),
  },
  "documents.issueDocumentAction": {
    run: ({ call, target }) => call("documents.issueDocumentAction", target.draftDocId),
    control: "writes",
  },
  "documents.creditNoteAction": {
    run: ({ call, target }) => call("documents.creditNoteAction", target.issuedDocId),
    control: "writes",
  },
  "documents.setDocumentMorningNumberAction": {
    run: ({ call, target }) => call("documents.setDocumentMorningNumberAction", target.draftDocId, "12345"),
    control: "writes",
  },
  "morning-docs.attachMorningNumberToSessionAction": {
    run: ({ call, target }) =>
      call(
        "morning-docs.attachMorningNumberToSessionAction",
        null,
        form({ sessionId: target.sessionId, number: "7001" }),
      ),
    control: "writes",
  },
  "morning-docs.assignMorningDocumentAction": {
    run: async ({ call, target, me, mode }) => {
      const assign = "morning-docs.assignMorningDocumentAction";
      if (mode === "control") return call(assign, form({ docId: me.morningDocId, clientId: me.clientId }));
      // their document to my client, and my document to their client
      await call(assign, form({ docId: target.morningDocId, clientId: me.clientId }));
      await call(assign, form({ docId: me.morningDocId, clientId: target.clientId }));
    },
    control: "writes",
  },

  // ── older invoices and payments ──────────────────────────────────────────
  "invoices.markInvoiceSentAction": {
    run: ({ call, target }) => call("invoices.markInvoiceSentAction", form({ id: target.draftDocId })),
    control: "writes",
  },
  "invoices.cancelInvoiceAction": {
    run: ({ call, target }) => call("invoices.cancelInvoiceAction", form({ id: target.oldInvoiceId })),
    control: "writes",
  },
  "invoices.sendInvoiceEmailAction": {
    run: ({ call, target }) => call("invoices.sendInvoiceEmailAction", null, form({ id: target.oldInvoiceId })),
    control: has("sent"),
  },
  "invoices.issueMorningReceiptAction": {
    run: ({ call, target }) => call("invoices.issueMorningReceiptAction", null, form({ id: target.oldInvoiceId })),
    control: "writes",
  },
  "payments.recordPaymentAction": {
    run: ({ call, target }) =>
      call(
        "payments.recordPaymentAction",
        null,
        form({ invoiceId: target.oldInvoiceId, amount: "50", method: "CASH", paidAt: "2026-11-01" }),
      ),
    control: "writes",
  },
  "payments.deletePaymentAction": {
    run: ({ call, target }) => call("payments.deletePaymentAction", form({ id: target.paymentId })),
    control: "writes",
  },

  // ── notes ────────────────────────────────────────────────────────────────
  "notes.saveNoteAction": {
    run: ({ call, target }) =>
      call("notes.saveNoteAction", null, form({ sessionId: target.sessionId, content: "טקסט חדש" })),
    control: "writes",
  },
  "notes.appendNoteToSessionAction": {
    run: ({ call, target }) => call("notes.appendNoteToSessionAction", target.sessionId, "עוד טקסט"),
    control: "writes",
  },

  // ── sessions ─────────────────────────────────────────────────────────────
  "sessions.checkOverlapAction": {
    // Their meeting's id as the one to leave out, with "all following"
    run: ({ call, target }) =>
      call("sessions.checkOverlapAction", {
        startLocal: firstMeetingLocal(0),
        endLocal: firstMeetingLocal(1),
        excludeId: target.seriesSessionId,
        applyScope: "future",
      }),
    control: "reads",
  },
  "sessions.sessionScopeInfoAction": {
    run: ({ call, target }) => call("sessions.sessionScopeInfoAction", target.sessionId),
    control: "reads",
  },
  "sessions.createSessionAction": {
    run: ({ call, target }) =>
      call(
        "sessions.createSessionAction",
        null,
        form({ clientId: target.clientId, startsAt: "2030-03-05T10:00", durationMinutes: "50", location: "OFFICE" }),
      ),
    control: "writes",
  },
  "sessions.updateSessionAction": {
    run: async ({ call, target, me, mode }) => {
      const update = "sessions.updateSessionAction";
      if (mode === "control") return call(update, null, sessionForm(me.sessionId, me.clientId));
      return [
        await call(update, null, sessionForm(target.sessionId, me.clientId)),
        // my meeting moved over to their client
        await call(update, null, sessionForm(me.sessionId, target.clientId)),
      ];
    },
    control: "writes",
  },
  "sessions.updateSessionStatusAction": {
    run: ({ call, target }) =>
      call("sessions.updateSessionStatusAction", form({ id: target.sessionId, status: "CANCELLED" })),
    control: "writes",
  },
  "sessions.rescheduleSessionAction": {
    run: ({ call, target }) =>
      call("sessions.rescheduleSessionAction", {
        id: target.sessionId,
        startsAt: "2030-03-05T10:00:00.000Z",
        endsAt: "2030-03-05T10:50:00.000Z",
      }),
    control: "writes",
  },
  "sessions.deleteFutureSessionsAction": {
    run: ({ call, target }) => call("sessions.deleteFutureSessionsAction", form({ id: target.seriesSessionId })),
    control: "writes",
  },
  "sessions.quickEditSessionAction": {
    run: async ({ call, target, me, mode }) => {
      const edit = "sessions.quickEditSessionAction";
      if (mode === "control") return call(edit, null, quickEdit(me.sessionId, me.clientId));
      return [
        await call(edit, null, quickEdit(target.sessionId, me.clientId)),
        await call(edit, null, quickEdit(me.sessionId, target.clientId)),
      ];
    },
    control: "writes",
  },
  "sessions.saveSessionPaymentAction": {
    run: ({ call, target }) =>
      call(
        "sessions.saveSessionPaymentAction",
        null,
        form({ sessionId: target.sessionId, paymentStatus: "PAID", paymentMethod: "CASH", paidAmount: "100" }),
      ),
    control: "writes",
  },
  "sessions.deleteSessionAction": {
    run: ({ call, target }) => call("sessions.deleteSessionAction", form({ id: target.sessionId })),
    control: "writes",
  },
  "sessions.deleteClientFutureSessionsAction": {
    run: ({ call, target }) =>
      call("sessions.deleteClientFutureSessionsAction", form({ clientId: target.clientId })),
    control: "writes",
  },

  // ── inbox, tasks, meeting types, waiting list ────────────────────────────
  "inbox.processInboxMessageAction": {
    run: ({ call, target }) => call("inbox.processInboxMessageAction", target.inboxId),
    control: "reads",
  },
  "inbox.deleteInboxMessageAction": {
    run: ({ call, target }) => call("inbox.deleteInboxMessageAction", target.inboxId),
    control: "writes",
  },
  "inbox.submitAppointmentRequestAction": {
    // The public form: only the public link works, never an API key or an id
    run: async ({ call, target, mode }) => {
      const submit = "inbox.submitAppointmentRequestAction";
      const fields = { name: "פונה", phone: "0500000000" };
      if (mode === "control") return call(submit, null, form({ token: target.inboxToken, ...fields }));
      return [
        await call(submit, null, form({ token: target.inboxApiToken, ...fields })),
        await call(submit, null, form({ token: target.userId, ...fields })),
      ];
    },
    control: "writes",
  },
  "todos.toggleTodoAction": {
    run: ({ call, target }) => call("todos.toggleTodoAction", target.todoId),
    control: "writes",
  },
  "todos.deleteTodoAction": {
    run: ({ call, target }) => call("todos.deleteTodoAction", target.todoId),
    control: "writes",
  },
  "meeting-types.setMeetingTypeColorAction": {
    run: ({ call, target }) =>
      call("meeting-types.setMeetingTypeColorAction", form({ id: target.meetingTypeId, color: "#112233" })),
    control: "writes",
  },
  "meeting-types.deleteMeetingTypeAction": {
    run: ({ call, target }) => call("meeting-types.deleteMeetingTypeAction", form({ id: target.meetingTypeId })),
    control: "writes",
  },
  "waitlist.updateWaitlistEntryAction": {
    run: ({ call, target }) =>
      call("waitlist.updateWaitlistEntryAction", null, form({ id: target.waitlistId, fullName: "שם חדש" })),
    control: "writes",
  },
  "waitlist.deleteWaitlistEntryAction": {
    run: ({ call, target }) => call("waitlist.deleteWaitlistEntryAction", target.waitlistId),
    control: "writes",
  },

  // ── operator actions: a practice can never reach them ────────────────────
  "invites.revokeInviteCodeAction": {
    admin: true,
    run: ({ call, target }) => call("invites.revokeInviteCodeAction", form({ id: target.inviteId })),
    control: "writes",
  },
  "subscription.extendSubscriptionAction": {
    admin: true,
    run: ({ call, target }) =>
      call("subscription.extendSubscriptionAction", form({ userId: target.userId, plan: "YEARLY" })),
    control: "writes",
  },
  "subscription.toggleSubscriptionExemptAction": {
    admin: true,
    run: ({ call, target }) =>
      call("subscription.toggleSubscriptionExemptAction", form({ userId: target.userId })),
    control: "writes",
  },
  "support.setSupportRequestStatusAction": {
    admin: true,
    run: ({ call, target }) =>
      call("support.setSupportRequestStatusAction", form({ id: target.supportId, status: "DONE" })),
    control: "writes",
  },
};

/** Routes, keyed by their path under src/app/api. */
export const ROUTE_CASES: Record<string, Case> = {
  "clients/[id]/summaries": {
    run: ({ hit, target }) =>
      hit("clients/[id]/summaries", `/api/clients/${target.clientId}/summaries`, {
        params: { id: target.clientId },
      }),
    control: okResponse,
  },
  "invoices/[id]/pdf": {
    run: ({ hit, target }) =>
      hit("invoices/[id]/pdf", `/api/invoices/${target.oldInvoiceId}/pdf`, {
        params: { id: target.oldInvoiceId },
      }),
    control: okResponse,
  },
  "expenses/[id]": {
    run: ({ hit, target }) =>
      hit("expenses/[id]", `/api/expenses/${target.expenseId}?download=1`, {
        params: { id: target.expenseId },
      }),
    control: okResponse,
  },
  "documents/[id]": {
    run: ({ hit, target }) =>
      hit("documents/[id]", `/api/documents/${target.documentId}?download=1`, {
        params: { id: target.documentId },
      }),
    control: okResponse,
  },
  "files/[id]": {
    run: ({ hit, target }) =>
      hit("files/[id]", `/api/files/${target.fileId}`, { params: { id: target.fileId } }),
    control: okResponse,
  },
  "support/[id]/attachment": {
    run: ({ hit, target }) =>
      hit("support/[id]/attachment", `/api/support/${target.supportId}/attachment`, {
        params: { id: target.supportId },
      }),
    control: okResponse,
  },
  "calendar/[token]": {
    // Only the feed's own token opens it: not the owner's id or their other keys
    run: async ({ hit, target, mode }) => {
      const feed = (token: string) =>
        hit("calendar/[token]", `/api/calendar/${token}`, { params: { token } });
      if (mode === "control") return feed(target.calendarToken);
      const answers = [
        await feed(target.userId),
        await feed(target.inboxToken),
        await feed(target.inboxApiToken),
      ];
      return answers.find((r) => r.status === 200) ?? answers[0];
    },
    control: okResponse,
  },
  inbox: {
    // The public request link and the account id are not API keys
    run: async ({ hit, target, mode }) => {
      const post = (token: string) =>
        hit("inbox", "/api/inbox", {
          method: "POST",
          body: "הודעה מבחוץ",
          headers: { authorization: `Bearer ${token}`, "content-type": "text/plain" },
        });
      if (mode === "control") return post(target.inboxApiToken);
      const answers = [await post(target.inboxToken), await post(target.userId)];
      return answers.find((r) => r.status === 200) ?? answers[0];
    },
    control: okResponse,
  },
};

/** Actions that take no id or token of anything: they work on the signed-in account only. */
export const NO_ID_INPUT: Record<string, string> = {
  "account.sendReauthCodeAction": "own account",
  "account.prepareAccountExportAction": "own account; the grant is bound to it (account-export.db.test.ts)",
  "account.closeAccountAction": "own account (account-closure.db.test.ts)",
  "account.restoreAccountAction": "own account (account-closure.db.test.ts)",
  "auth.signOutAction": "own session",
  "auth.idleSignOutAction": "own session",
  "auth.loginAction": "sign-in: email and password, no record id",
  "auth.registerAction": "creates a new account",
  "auth.requestPasswordResetAction": "by email address, answers the same either way",
  "auth.resetPasswordAction": "by single-use emailed token (password-reset tests)",
  "auth.googleSignInAction": "sign-in",
  "auth.googleRegisterAction": "sign-in",
  "auth.verifyTwoFactorAction": "the user comes from the pending session, never the request",
  "auth.cancelTwoFactorAction": "own session",
  "auth.requestLoginCodeAction": "by email address, answers the same either way",
  "auth.verifyLoginCodeAction": "by email and single-use code (login-code tests)",
  "auth.resendVerificationAction": "by email address, answers the same either way",
  "auth.confirmEmailAction": "by single-use emailed token (email-verification tests)",
  "inbox.generateInboxTokenAction": "own account",
  "inbox.revokeInboxTokenAction": "own account",
  "meeting-types.addMeetingTypeAction": "creates under the signed-in user",
  "morning-docs.syncMorningDocumentsAction": "own account; rows keyed by userId + morning id",
  "onboarding.setOnboardingStepAction": "own account",
  "onboarding.pauseOnboardingAction": "own account",
  "settings.calendarFeedEnableAction": "own account",
  "settings.calendarFeedDisableAction": "own account",
  "settings.calendarFeedModeAction": "own account",
  "settings.acceptAgreementAction": "own account",
  "settings.updateBusinessInfoAction": "own account",
  "expenses.uploadExpenseAction": "creates one of the caller's own, from a file",
  "settings.updateDocumentDefaultsAction": "own account",
  "documents.documentNextNumberAction": "a document type; the answer is morning's for the caller's own keys",
  "settings.updateSessionDefaultsAction": "own account",
  "settings.updateBrandingAction": "own account",
  "settings.setShowHolidaysAction": "own account",
  "settings.updatePersonalDetailsAction": "own account",
  "settings.changePasswordAction": "own account",
  "settings.sendSetPasswordLinkAction": "own account",
  "settings.saveMorningSettingsAction": "own account",
  "settings.disconnectMorningAction": "own account",
  "settings.updateIdleTimeoutAction": "own account",
  "invites.createInviteCodeAction": "admin only; creates a code, reads no id",
  "subscription.startCardPaymentAction": "own account; the plan is the only input",
  "subscription.requestPlanAction": "own account; the plan is the only input",
  "support.submitSupportRequestAction": "creates under the signed-in user",
  "todos.addTodoAction": "creates under the signed-in user",
  "two-factor.startTotpEnrollmentAction": "own account",
  "two-factor.confirmTotpEnrollmentAction": "own account",
  "two-factor.regenerateBackupCodesAction": "own account",
  "two-factor.disableTotpAction": "own account",
  "waitlist.addWaitlistEntryAction": "creates under the signed-in user",
};

/** Routes that take no id of anything a practice owns. */
export const NO_ID_ROUTES: Record<string, string> = {
  "account/export": "own account: a one-time grant bound to the session user (account-export.db.test.ts)",
  "auth/[...nextauth]": "sign-in",
  "billing/webhook": "no caller identity: trusts only a stored checkout confirmed with Grow (grow-callback tests)",
  "cron/reminders": "system job behind CRON_SECRET",
  "csp-report": "nothing read, nothing stored",
  health: "SELECT 1, returns no data",
  "invoices/documents": "filters only, scoped by the session user (income-doc-list.db.test.ts)",
  "reports/income": "dates only, scoped by the session user (own test in isolation.db.test.ts)",
};
