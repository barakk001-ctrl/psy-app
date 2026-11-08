# Accounting module: current architecture (phase 0 audit)

Audited at commit `c71a00a` (8 November 2026), after morning was removed in `71b9260` and `749bac0`.
This describes what the repository actually contains today. It changes nothing.

Companion documents: [compliance-matrix.md](compliance-matrix.md), [data-model.md](data-model.md), [implementation-plan.md](implementation-plan.md).

---

## 1. Stack, and how Barak's specification maps onto it

The specification assumes Kotlin, Ktor, Exposed, Flyway, Kotest and Testcontainers. The app is none of these, and the specification itself says not to replace existing infrastructure. Its design maps onto the real stack like this:

| Specification | psy-app today | Where |
|---|---|---|
| Kotlin backend, Ktor routes | Next.js 15.5 App Router, React 19, TypeScript. Mutations are **server actions**; there are only a few API routes (GET downloads, auth, cron, webhook, inbox) | `src/server/actions/*`, `src/app/api/*` |
| `/api/v1/accounting` REST endpoints | Server actions for mutations, GET route handlers for files | pattern in `CLAUDE.md` → "Mutations are server actions" |
| Exposed / jOOQ repositories | Prisma 6 (`@prisma/client`), plus raw SQL where needed (`$queryRaw` in `src/lib/rate-limit.ts`, `src/lib/invite-store.ts`) | `prisma/schema.prisma`, `src/lib/db.ts` |
| Flyway migrations | Prisma Migrate, 55 committed migrations; `prisma migrate deploy` runs on every Railway start | `prisma/migrations/`, `railway.json` |
| Kotest + Testcontainers | Vitest 4. Pure rules in `src/lib/__tests__`; real-Postgres suites `src/server/__tests__/*.db.test.ts` against a throwaway local DB or the CI Postgres 16 service container | `vitest.config.ts`, `src/server/__tests__/db-harness.ts`, `.github/workflows/ci.yml` |
| `BigDecimal` money | Prisma `Decimal` columns; the document flow computes in integer agorot (`parseAgorot`, `agorotToDecimalString`) | `src/lib/billing-docs.ts` |
| Background worker | In-process hourly timer (`setInterval`, `unref`) in the single long-lived Node process; no queue, no outbox | `src/server/maintenance.ts`, `src/instrumentation.ts` |
| S3-compatible object storage | None. Bytes live in Postgres `bytea` behind a `DocumentBlobStore` put/get/delete interface, encrypted above the store | `src/lib/document-storage.ts`, `src/lib/document-storage-pg.ts` |
| PDF and signing | `@react-pdf/renderer` 4 with Heebo; no signing of any kind | `components/invoices/document-pdf.tsx`, `components/invoices/invoice-pdf.tsx` |
| Feature flags `accounting.enabled` etc. | Environment variables read at runtime, off unless set (the pattern used by Turnstile, Sentry, Grow, `SIGNUP_OPEN`) | e.g. `src/lib/turnstile.ts` |

Runtime: Railway project Clinic, service `psy-app` in `europe-west4`, database service `Postgres-EU` (Amsterdam). Nixpacks build (`npm run build`), start command `npx prisma migrate deploy && npm run start`, health check `/api/health`. Nightly `pg_dump` from Barak's machine to `E:\psy-app-backups` (task `PsyAppDbBackup`).

---

## 2. Tenant model and isolation

- **The tenant is the `User` row.** One user is one practice, which is the specification's "business". There is no business table, no membership, and no roles (only `User.isAdmin` for the operator). Business details used on documents are columns on `User`: `businessName`, `businessId` (ת.ז / ע.מ / ח.פ), `vatLiable`, `address`, `phone`, `docEmail`, `website`, `occupation`, `businessDescription`, and the English variants.
- **Authorization is "every query is scoped by `userId`"**. Each action has a local `requireUserId()` (`auth()` → `session?.user?.id`).
- **Isolation is tested on real Postgres.** `src/server/__tests__/isolation.db.test.ts` runs every case in `isolation-cases.ts` three ways (practice B on A's ids, a guest, A on A's own ids). `src/lib/__tests__/isolation-coverage.test.ts` runs in every `npm test` and fails when a new exported action or API route has no case (or no `NO_ID_INPUT` / `NO_ID_ROUTES` entry with a reason).
- **`db` vs `dbAll`** (`src/lib/db.ts`): `db` is a Prisma extension that hides clients in the recycle bin from every read (`src/lib/trash-filter.ts`); `dbAll` is the raw client, used by the bin, the account purge and the export.

Reuse: everything. New accounting tables carry `userId` and every query is scoped by it; each new action gets an isolation case.

---

## 3. Documents and drafts

"מסמך חדש" (since 2026-10-14) stores every income document as an **`Invoice` row with `docType`** set:

| Code | Kind | Who may create | Flags (`DOC_KINDS`, `src/lib/billing-docs.ts`) |
|---|---|---|---|
| 305 | חשבונית מס | VAT-liable only | items, due date, tax id, meetings |
| 320 | חשבונית מס/קבלה | VAT-liable only | items, payments, tax id, meetings |
| 400 | קבלה | everyone | payments, meetings (no item lines) |
| 330 | חשבונית זיכוי | VAT-liable only | items |

`Invoice.docType = null` marks an **older app invoice** (a payment request, before 2026-10-14) with its own PDF (`InvoicePDF`).

Files:
- Rules (pure, tested): `src/lib/billing-docs.ts` (`DOC_KINDS`, `documentTotals`, `documentProblems`, `draftSaveProblems`, `canCreditNote`, `COUNTS_AS_MONEY`, `UNISSUED_DOCUMENT`, `UNLINKED_SESSION`). Tests: `src/lib/__tests__/billing-docs.test.ts`.
- DB side: `src/lib/billing-doc-data.ts` (`draftFromInvoice`, `linkDraftSessions`, `applyCreditNote`, `loadCreditableInvoices`).
- Actions: `src/server/actions/documents.ts` (`saveDocumentAction`, `creditNoteAction`, `recordDocumentNumberAction`), validator `src/server/validators/billing-document.ts`.
- UI: `src/components/invoices/document-form.tsx`, `document-view.tsx`, `document-preview.tsx`, `document-actions.tsx`, `issue-coming-soon.tsx` (what "הפקת מסמך" shows today), `doc-kind-squares.tsx`.
- Lists: `src/lib/income-doc-list.ts`, `income-doc-rows.ts`, `GET /api/invoices/documents`.
- DB suites: `src/server/__tests__/document-form.db.test.ts`, `income-documents.db.test.ts`, `income-doc-list.db.test.ts`, `document-settings.db.test.ts`.

How a draft behaves:
- `saveDocumentAction(json)` creates the row in a transaction that increments **`User.nextInvoiceNumber`** and stores it as `Invoice.number` (unique per user). That counter is shared by drafts, credit-note drafts and older invoices, and **drafts consume it**. It is an internal row number, not a legal document number.
- Editing a draft (`draftId`) is a conditional `updateMany` (no number, not cancelled, not settling an invoice) followed by **deleting and re-creating every item and payment row** (`items: { deleteMany: {}, create }`).
- Ticked meetings stay in `Invoice.draftSessionIds` until the document has a number.
- The document stores client details as printed (`docClientName`, `docClientTaxId` in the clear, `docClientEmail`), but **no client address**.
- Per-document settings: `currency`, `lang`, `vatType`, `rounding`, `vatIncluded`, `description`, `notes`, `dueDate`, `relatedInvoiceId`.

**"Issued" today means "has a number from somewhere else".** `COUNTS_AS_MONEY` is `docType null OR morningDocId not null OR morningDocNumber not null`. This test is spelled out in 19 source files: pages (`invoices`, `invoices/new`, `clients/[id]`, `sessions/[id]`), `session-list.tsx`, `document-view.tsx`, and in `src/lib`: `account-export`, `billing-doc-data`, `billing-docs`, `bulk-delete`, `client-trash-data`, `income-data`, `income-doc-list`, `income-doc-rows`, `invoice-pdf-data`, `session-scope`, plus the actions `document-numbers`, `documents` and `invoices`.

---

## 4. Payments

- **`Payment`** (receipt lines of a document, or payments recorded on an older invoice): `amount` Decimal(10,2), `method` (`PaymentMethod` enum: CASH, BIT, PAYBOX, CHECK, BANK_TRANSFER, CREDIT_CARD, PAYPAL, OTHER, PAYONEER, GOOGLE_PAY, APPLE_PAY, GIFT_VOUCHER), `paidAt`, `reference`, `notes`, bank / branch / account, `chequeNumber`, card type / last 4 / deal type / installments, `provider` / `providerTxId`. **There is no cheque due date.** No full card numbers are stored.
- **Per-meeting quick payment** on `Session`: `paymentStatus` (PAID / UNPAID / EXEMPT), `paymentMethod`, `paidAmount`, `paymentNote`. This counts as income on its own when no document covers the meeting.
- Older invoices: `recordPaymentAction` and `deletePaymentAction` (`src/server/actions/payments.ts`). Both recompute `amountPaid` with JavaScript `Number` (float) instead of Decimal, and **`deletePaymentAction` deletes a payment from any invoice of the user, including a document that has a recorded number** (it checks ownership only).
- A receipt (400) for a tax invoice (305) raises the invoice's `amountPaid` when the receipt draft is saved (money is counted once, on the receipt's payments). `cancelInvoiceAction` gives it back for a cancelled receipt draft.

---

## 5. Meetings and their links

- `InvoiceItem.sessionId` is unique: a meeting is on at most one document. `linkOnly` items tie a meeting to a document without printing it.
- `linkDraftSessions` (`billing-doc-data.ts`) turns `draftSessionIds` into `linkOnly` items when the number is recorded, and writes the number into the meeting's own field.
- Session number fields (names kept from the morning era): `morningDocNumber` (305), `morningReceiptNumber` (400), `morningInvoiceReceiptNumber` (320), each with a URL column. They are also typed by hand on the session page (`attachDocumentNumberToSessionAction`, `src/server/actions/document-numbers.ts`).
- `UNLINKED_SESSION` decides which meetings "מסמך חדש" suggests.
- Meetings with a payment record, document or number are protected from bulk deletion and from client deletion (`src/lib/bulk-delete.ts`, `src/lib/client-trash.ts`), but **meetings without them are hard-deleted**: single delete, "all future meetings", deactivation of a client, and the recycle-bin purge after 30 days.

---

## 6. Credit notes

- `creditNoteAction` creates a credit-note draft (330) for the whole of an issued 305/320 (`canCreditNote`: has a morning id or a recorded number, not cancelled). A linked credit note must add up to the original; a partial credit stays unlinked.
- When the credit note's own number is recorded, **`applyCreditNote` mutates the original**: sets its status to CANCELLED, sets every `InvoiceItem.sessionId` of the original to null, and clears the original's number from its meetings.
- Credit notes are VAT-liable only (`vatLiableOnly: true`), so an עוסק פטור has no way in the app to cancel a receipt.
- There is no "reason for the credit" field (only free `notes`).

---

## 7. The recorded-number path and legacy morning data

- `recordDocumentNumberAction(invoiceId, number)`: digits only, ≤30 characters; refuses a cancelled or incomplete draft (`documentProblems`); checks a linked credit note adds up; then, in one transaction, sets `Invoice.morningDocNumber`, moves the status, links meetings and applies a credit note. **There is no uniqueness check** for the number within a document type.
- Legacy: `Invoice.morningDocId/morningDocUrl/morningIssuedAt` (documents morning issued until 2026-11-08), the `MorningDocument` table (documents imported from morning, assignable to clients), and the session number fields. All are kept as history and count as money.
- Older invoices' PDFs say they are receipts, not tax invoices; draft PDFs say "טיוטה … אינה מסמך מס".

---

## 8. Next-number and document settings (added in `749bac0`)

- `User.docNextTaxInvoice`, `docNextTaxInvoiceReceipt`, `docNextReceipt`, `docNextCreditNote` (Int, default 1). Migration `20261108210000_document_settings_more`.
- Rules: `NEXT_NUMBER_FIELDS`, `NUMBERED_KINDS`, `MAX_DOC_NUMBER` (999,999,999), `parseNextNumber` in `src/lib/document-look.ts`.
- `updateDocumentNumberingAction` (`src/server/actions/settings.ts`) accepts any whole number from 1, **including a lower one**. Its comment already says that once issuing exists "a number must never go below one already used". Nothing reads these values yet.
- UI: `src/components/settings/document-numbering-card.tsx` (an exempt business sees only קבלה).
- Other document settings on `User`: `docTemplate` (classic / band / minimal), `docColor`, `docEmailSubject` / `docEmailBody` (placeholders, `fillEmailTemplate`; nothing is sent yet), `defaultDocType` (column `morningDocType`), `docCurrency`, `docLang`, `docVatType`, `docRounding`, `logoOnDocuments`.
- Business details for documents come from one place: `docBusiness` / `DOC_BUSINESS_SELECT` (`src/lib/document-business.ts`).

---

## 9. Preview and PDF pipeline

- `DocumentPreview` renders in the app; `previewNotice` puts a band on it ("טיוטה — עדיין לא מסמך מס", or for a recorded number "לעיון בלבד — המסמך הרשמי הוא זה שהופק במערכת ההפקה").
- `GET /api/invoices/[id]/pdf` (`src/app/api/invoices/[id]/pdf/route.tsx`) renders `DocumentPDF` (`loadDocumentPdfData`, `src/lib/invoice-pdf-data.ts`) for any document with `docType`, and `InvoicePDF` for older invoices. Guarded by `session.user.id`; 404 unless the owner matches.
- **PDFs are rendered on demand from the live `Invoice` row and the live `User` business details, logo and signature image.** Nothing is stored, hashed or versioned. If the therapist changes her address or logo, every past document's PDF changes with it.
- `renderPdf` (`components/invoices/invoice-pdf.tsx`) re-registers Heebo per render and runs renders one at a time (see the PDF rules in `CLAUDE.md`). Test: `src/lib/__tests__/document-pdf.test.ts`, `pdf-render.test.ts`.
- No PDF carries "מקור", "העתק", "מסמך ממוחשב" or "נפרע".
- The only path that emails a document is `sendInvoiceEmailAction` (`src/server/actions/invoices.ts`) for **older** invoices, through `sendEmail` (`src/lib/email.ts`, Resend EU).

---

## 10. Storage for logos and signatures

- `User.logoUrl` and `User.signatureUrl` are **data: URLs in the user row** (scaled in the browser; validated by `isValidLogoDataUrl` / `isValidSignatureDataUrl`; signature ≤ 300k characters, PNG or JPEG).
- **The signature is a picture of a handwritten signature. It is not a secured or certified electronic signature** in the sense of the Electronic Signature Law, and nothing signs the PDF.
- Files (client documents, expenses, session files) are encrypted with AES-256-GCM and stored as `bytea` in their own blob tables behind `DocumentBlobStore`, ready to move to an EU object store.

---

## 11. Write lock (`requireWritable`)

`src/lib/subscription-server.ts`: every mutating action calls `isReadOnly(userId)` or `requireWritable(userId)`. An expired subscription or a closed account is read-only. `src/lib/__tests__/write-lock.test.ts` fails for any exported action that is neither gated nor on its allowlist. Downloads (GET routes) stay open.

Consequence for accounting: **a therapist whose Mirpaa subscription expired cannot issue a receipt**, but can still read and download. That is a product decision to confirm, not a legal one.

---

## 12. Encryption

- `src/lib/crypto.ts`: AES-256-GCM, key versions (`NOTES_ENCRYPTION_KEY`, `_V2`, …), `encryptSecret` / `decryptSecret` for packed strings, `encryptBuffer` for files.
- `src/lib/reencrypt.ts` (`npm run data:reencrypt`) **rewrites ciphertext in place** during key rotation, with conditional writes. Any write-once table that holds ciphertext would block rotation, so the data model keeps ciphertext in side tables (see [data-model.md](data-model.md) §5).
- `src/lib/sensitive-fields.ts`: `Client.idNumber` and others moving to encrypted columns; **`Invoice.docClientTaxId` is still in the clear.**

---

## 13. Audit log

- `AuditLog` model, `logAudit` in `src/lib/audit.ts`: action, `sessionId` / `clientId` / `documentId`, time. No FK relations so entries outlive their subjects.
- **Best-effort by design**: failures are swallowed, it is written outside the business transaction, and it has no metadata, no actor separate from the owner, and no tamper evidence.
- It is mutable in practice: **`purgeAccount` deletes all of an account's audit rows.**
- It covers clinical access and sign-ins. Nothing about documents (saving drafts, recording numbers, credit notes) is logged.

---

## 14. Jobs

- `src/server/maintenance.ts`: `runMaintenance()` a minute after boot, then hourly, once per process; also run by `GET /api/cron/reminders` (Bearer `CRON_SECRET`), which nothing calls on Railway. Jobs: purge closed accounts, purge clients 30 days in the bin, top up open-ended series, retry support emails, delete expired rate-limit rows, subscription notices.
- Idempotency patterns already used: claim-before-send rows (`SubscriptionNotice` unique key, `ReminderJob` optimistic flip, `SupportRequest.emailStatus`), conditional `updateMany` (note autosave, invite claim inside the creating transaction).
- **No `SELECT … FOR UPDATE` and no `SKIP LOCKED` anywhere.** Counters are single atomic `UPDATE … increment` statements inside a transaction (`nextInvoiceNumber`), which do take a row lock until commit.
- No outbox, no retry queue with backoff, no worker separate from the web process.

---

## 15. Retention and deletion

- **Closing an account deletes its documents.** `purgeAccount` (`src/lib/account-closure-data.ts`), run hourly 30 days after the owner closes the account, does `tx.invoice.deleteMany({ where: { userId } })` (payments and items cascade), deletes the audit log, then the user (cascading clients, meetings, `MorningDocument`, everything else). The data-holding agreement (`src/lib/agreement.ts`) and `/privacy` promise deletion within 30 days of closure. `account-closure.db.test.ts` asserts that nothing of the account remains in any text column.
- A client can't be deleted while it has invoices, paid meetings or morning documents (`clientDeletionDecision`, `src/lib/client-trash.ts`), and `Invoice → Client` is `ON DELETE RESTRICT`.
- Nightly backups rotate (about 30 days), on Barak's machine in Israel.
- The account export (`src/lib/account-export.ts`) includes all documents as CSV and the settings in `חשבון.json`.

---

## 16. Migrations, CI and deploy

- Prisma Migrate, 55 migrations; **no SQL triggers, functions, `REVOKE`s or check constraints in any migration** so far. Raw SQL exists only in queries.
- The app connects with one `DATABASE_URL` (`${{Postgres-EU.DATABASE_URL}}`). Railway's Postgres template normally hands out its owner role; **assumed, not verified (it needs a look at production, which this audit did not do)**: the app role owns the tables and could alter or drop triggers.
- CI (`.github/workflows/ci.yml`): `npm ci`, `prisma generate`, lint, `tsc --noEmit`, `npm test` with a Postgres 16 service (so `*.db.test.ts` run), build. Node 20.
- Test harness (`src/server/__tests__/db-harness.ts`): a fresh schema per suite with every migration applied, `truncateAll` between tests (**TRUNCATE of every table**, which a TRUNCATE-blocking trigger would break), refuses any non-local DB or a name without "test".
- Deploy: push to `main` → Railway builds and runs `prisma migrate deploy` before the app starts; the health check gates traffic.

---

## 17. What can be reused

| Need | Reuse |
|---|---|
| Drafts | `Invoice` rows with `docType`, the form, preview, `documentProblems`, `draftFromInvoice`. **Agreed: the existing drafts stay as the drafts.** |
| Totals and money | Agorot helpers (`parseAgorot`, `lineAgorot`, `documentTotals`); Decimal columns |
| Payment lines | `Payment` columns map onto receipt lines (D120) with two additions (cheque due date, a structured "other" detail) |
| Meetings | `draftSessionIds` → `linkDraftSessions`; session number fields keep working for app-issued numbers |
| Income, debt, reports | `income.ts` / `income-data.ts` unchanged except the "issued" predicate (see data model §7) |
| Starting numbers | `User.docNext*` and the settings card seed the new sequences |
| Business details | `docBusiness` / `DOC_BUSINESS_SELECT` as the issuer snapshot source |
| PDF | `DocumentPDF`, `renderPdf`, the Heebo and RTL rules, `previewNotice` |
| File storage | `DocumentBlobStore` + `encryptBuffer` for stored PDF artifacts |
| Email | `sendEmail`, `docEmailSubject/Body` + `fillEmailTemplate` |
| Auth, tenant checks, write lock, tests | `requireUserId`, `isReadOnly`, isolation cases and coverage test, write-lock test, DB harness, CI Postgres |
| Jobs | The in-process scheduler pattern, claim-before-act idempotency |
| Flags | Runtime environment variables, off by default |

## 18. Gaps

| Gap | Why it matters | Planned in |
|---|---|---|
| No write-once storage; drafts edited by delete-and-recreate; credit notes mutate the original | Permanent file, no edits after issue | Phase 1 (`IssuedDocument` + triggers) |
| "Issued" = a nullable text column checked in 19 files | App-issued documents must plug in without changing totals | PR 1.1 (one predicate) |
| No per-type legal sequence; the internal counter is consumed by drafts | Consecutive numbering per type | Phase 1 (`DocumentSequence`) |
| Next-number setting can be lowered | Never reuse a number | PR 1.8 |
| PDFs from live data; nothing stored or hashed; no מקור / העתק / מסמך ממוחשב / נפרע | Copies must be identical; signed originals retained with signature | Phase 1 snapshots, phase 3 artifacts |
| No electronic signature (only an image) | ED-03 / ED-04 | Phase 3, gated by the signature blocker |
| No recipient consent record | ED-06 | Phase 3 |
| No client address on documents; no cheque due date; no credit-note reason | Required content | PR 2.1, 4.3 |
| VAT is a constant `VAT_RATE = 0.18` (`src/lib/vat.ts`, float math in `vatBreakdown`) | Rates change by date; snapshot must carry the rate used | PR 1.5 (rate table, values to be sourced) |
| Non-ILS and English documents can be drafted | Books in Hebrew and ILS | Blocked at issue in PR 2.1 |
| Audit log best-effort, outside transactions, deleted on purge | Traceability, append-only trail | Phase 1 (`AccountingEvent`) |
| No outbox / worker | PDF, signing, delivery, transmission must retry safely | PR 1.7 |
| Account purge deletes invoices; agreement promises deletion in 30 days | 7-year retention; permanent file never deleted | PR 1.8 guard + lawyer question |
| Meetings hard-deleted | Appendix ו' §4: appointment records are part of a psychologist's books | Open question; phase 5 |
| DB in the EU (Amsterdam) | Books in Israel | Blocker for production issuing (phase 7) |
| One DB role, probably the owner | Privilege-level immutability | Phase 7, needs an environment change (Barak's approval) |
| `deletePaymentAction` ignores numbers; float math in payments actions | Money rules, immutability | PR 1.2 |
| Test harness truncates every table | Breaks with TRUNCATE triggers | PR 1.4 |

## 19. Findings that change the plan

1. **Account closure deletes financial records.** The 30-day purge deletes every invoice and payment, and the agreement and privacy policy promise it. That contradicts 7-year retention and "the permanent file is never deleted". New blocker ("retention after a therapist leaves") and a phase 1 guard: an account with issued documents must not be purged. Plus a question for the lawyer about who holds the books afterwards.
2. **"Issued" has no single definition.** The issued test is a nullable `morningDocNumber` / `morningDocId` check copied into 19 files, and `Invoice.number` is an internal counter that drafts consume. The legal number must be a separate per-type sequence, and the "issued" predicate must be consolidated first (PR 1.1) so app-issued documents count exactly like recorded ones.
3. **Nothing is immutable today, at any level.** There are no triggers, constraints or privileges, drafts are rewritten by delete-and-recreate, credit notes mutate the original, and a payment on a numbered document can be deleted. Immutability needs database triggers in phase 1. Real privilege separation needs a second DB role, which is an environment change (Barak's approval), and the test harness has to change because it truncates every table.
4. **PDFs are live renders, and the "signature" is an image.** Copies would drift from the original, nothing is retained as issued, and the signature setting does not meet the e-signature rule. Snapshots (phase 1) and stored, signed artifacts (phase 3) are needed. Key rotation rewrites ciphertext in place, so ciphertext has to stay out of write-once rows.
5. **For psychologists the calendar is part of the books** (research: Appendix ו' §4), but the app hard-deletes meetings in five places. This widens the scope beyond documents and is added as an open question and a phase 5 item. Also: the audit log is best-effort and deletable, so the accounting trail needs its own append-only table.
