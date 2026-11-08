# Accounting module: implementation plan (phases 1–7)

Small, ordered PRs on the real stack (Next.js 15 server actions, Prisma, Postgres, Vitest and the repo's `*.db.test.ts` suites). Every PR follows the repo's rules in `CLAUDE.md`: actions are `requireUserId` → zod → Hebrew errors → every query scoped by `userId` → revalidate; business rules in `src/lib` with tests; each new action gets an isolation case and the write lock; lint, `tsc`, tests and build green before pushing; CI runs the DB suites.

Read with [current-architecture.md](current-architecture.md), [compliance-matrix.md](compliance-matrix.md) and [data-model.md](data-model.md). Requirement ids (REG-, CON-, ED-, …) are rows of the matrix. Questions (Q1–Q23) are at the end.

---

## Ground rules

- **Issuing stays off** in production until the accountant signs off and the blockers below that gate it are cleared. Code can be merged with every flag off; nothing in phases 1–6 requires a flag to be set in production.
- **Flags** are runtime environment variables, read in one place (`src/lib/accounting/flags.ts`, PR 1.5), off unless set to `true`:

| Flag | Turns on | First used |
|---|---|---|
| `ACCOUNTING_ENABLED` | The issuing UI (the "הפקה" panel instead of `IssueComingSoon`) | 2.3 |
| `ACCOUNTING_ISSUE_ENABLED` | The server accepting issue requests | 2.2 |
| `ACCOUNTING_ISSUE_USERS` | Optional allowlist of user ids (pilot); when set, only they may issue | 2.2 |
| `ACCOUNTING_WORKER_ENABLED` | The outbox worker in the app process | 1.7 |
| `ACCOUNTING_DELIVERY_ENABLED` | Emailing issued documents | 3.5 |
| `UNIFORM_EXPORT_ENABLED` | The uniform-file export | 5.3 |
| `TAX_AUTHORITY_SANDBOX_ENABLED` | ITA sandbox calls | 6.2 |
| `TAX_AUTHORITY_PRODUCTION_ENABLED` | ITA production calls | 6.5 |

  While this plan was written, a separate `DOCUMENTS_ENABLED` switch that hides the whole documents area was being built in parallel (uncommitted at the time). If it lands, the accounting flags take effect only while it is on, and `flags.ts` reads it rather than duplicating it.
  In production, issuing also refuses unless `SOFTWARE_REGISTRATION_NUMBER` is set (PR 2.2), so a flag set by mistake can't issue from unregistered software. **Setting any of these on Railway is an environment change and needs Barak's explicit approval.**
- **No Tax Authority request** before phase 6, and none to production before PR 6.5's gate. No endpoint, payload or record layout is written from memory: only from the official documents, versioned in the repo.
- **Data migrations preserve data.** Phase 1 migrations are additive. Anything touching existing rows is called out with its own approval.
- **Rollback** for additive PRs is a revert. A table added in phase 1 can be dropped by a follow-up migration **only while it is empty in production**, checked first (the count is reported by a read-only query Barak approves).

## Blockers and what they gate

| Id | Blocker | Gates | Questions |
|---|---|---|---|
| B1 | **Books kept in Israel.** The DB is on Railway in the EU (LOC-01, LOC-02) | Production issuing (any type); PR 7.1 | Q4 |
| B2 | **Digital signature model**: whose secured or certified signature, where the key lives (ED-03) | PR 3.2, 3.5; electronic originals | Q1 |
| B3 | **Cash and Bit under the signature rule** (ED-07) | PR 3.6; electronic delivery for those payments | Q2 |
| B4 | **"Every change is a new version"** (REG-11) | PR 5.7, 7.8; how accounting code is released after registration | Q5 |
| B5 | **Can מרום טכנולוגיות, an עוסק פטור, register as the software maker** (REG-04) | PR 5.7, 6.1 | Q21 |
| B6 | **חשבונית עסקה for עוסק פטור therapists** (CON-EX-03) | PR 4.5; production issuing for exempt therapists | Q8 |
| B7 | **Moving over from morning** and other systems: starting numbers, old originals, cross-system links (NUM-05) | PR 7.6; the first issue for a migrating therapist | Q9, Q18, Q19, Q22 |
| B8 | **New from the audit: retention after a therapist closes her account.** Today the purge deletes invoices and the agreement promises it (RET-01, RET-05) | PR 1.8 (guard), 7.4; production issuing | Q13 |
| B9 | **New from the audit: appointments are part of a psychologist's books** (PSY-03, PSY-04); the app hard-deletes meetings | PR 5.8; launch for psychologists | Q7, Q20 |
| — | Software registration itself (REG-01, REG-02) | Production issuing | — |

---

## Phase 1: foundation

No user-visible change. Ends with an issue service that is fully tested but not reachable from the UI or any action. This is the specification's "first PR" (§12), split into reviewable pieces.

### PR 1.1 One "issued" predicate (refactor)
- **Files:** `src/lib/billing-docs.ts` (add `isIssuedDocument`, `ISSUED_DOCUMENT`; express `COUNTS_AS_MONEY`, `UNISSUED_DOCUMENT`, `isUnissuedDocument`, `canCreditNote` through them); the 19 files listed in current-architecture §3 switch to them (`src/lib/income-data.ts`, `income-doc-list.ts`, `income-doc-rows.ts`, `billing-doc-data.ts`, `bulk-delete.ts`, `client-trash-data.ts`, `session-scope.ts`, `invoice-pdf-data.ts`, `account-export.ts`, `src/server/actions/documents.ts`, `invoices.ts`, `document-numbers.ts`, the pages and components).
- **Migration:** none.
- **Tests:** `billing-docs.test.ts` cases for each kind (older invoice, draft, morning id, recorded number, cancelled); all existing unit and DB suites unchanged and green.
- **Acceptance:** no behaviour change; `grep morningDocNumber` outside `billing-docs.ts`, the actions that write it, display code and the export finds no "is it issued" logic.
- **Rollback:** revert. **Flags:** none. **Gate:** none.

### PR 1.2 Close the money holes in existing paths
- **Files:** `src/server/actions/payments.ts` (`recordPaymentAction`, `deletePaymentAction` refuse a row with `docType` set or with a number; recompute `amountPaid` in agorot instead of `Number`), `src/server/actions/invoices.ts` (`markInvoiceSentAction` refuses documents with `docType`), tests.
- **Migration:** none.
- **Tests:** DB suite `payments.db.test.ts`: deleting a payment of a numbered document is refused and changes nothing; Decimal sums exact for amounts like 0.10 + 0.20; isolation cases unchanged.
- **Acceptance:** older invoices behave as before; numbered documents can't lose payments.
- **Rollback:** revert. **Flags:** none. **Gate:** none. Small behaviour change, only for requests the UI never sends.

### PR 1.3 Schema: write-once tables (additive)
- **Files:** `prisma/schema.prisma` (models of data-model §4 and the relation fields on `User` and `Invoice`), `prisma/migrations/2026MMDDhhmmss_accounting_foundation/migration.sql` (tables, indexes, composite tenant FKs, CHECK constraints).
- **Migration:** additive only; no existing row touched.
- **Tests:** the DB harness applies it in every suite; a schema test asserts the unique keys and CHECKs exist (`accounting-schema.db.test.ts`).
- **Acceptance:** `prisma migrate deploy` clean on an empty DB and on a copy of the current schema; Railway log shows the migration applied.
- **Rollback:** a follow-up migration dropping the tables, only after confirming they are empty. **Flags:** none. **Gate:** Barak approves the schema (an irreversible-in-spirit change once rows exist).

### PR 1.4 Immutability triggers
- **Files:** migration `…_accounting_write_once` (functions and triggers of data-model §6, including the frozen-draft rules on `Invoice`, `InvoiceItem`, `Payment`), `src/server/__tests__/db-harness.ts` (`truncateAll` inside `SET LOCAL session_replication_role = replica`), new `accounting-immutability.db.test.ts`.
- **Tests:** UPDATE, DELETE and TRUNCATE on each write-once table raise; `DocumentSequence` can't go down or be deleted; the secret's ciphertext can be rewritten but nothing else; a frozen draft refuses money and printed columns but accepts `status` and `amountPaid`; `InvoiceItem` accepts `linkOnly` inserts and `sessionId → NULL` only; `Payment` of an issued draft refuses everything; the harness still empties tables between tests; triggers fire in normal mode.
- **Acceptance:** all existing DB suites green (no existing code path touches an issued draft yet).
- **Rollback:** a migration dropping the triggers (empty tables). **Flags:** none. **Gate:** none.

### PR 1.5 Domain library (pure)
- **Files:** `src/lib/accounting/types.ts` (codes, kinds, series), `snapshot.ts` (canonical form, `snapshotHash`), `numbering.ts` (the `NEXT_NUMBER_FIELDS` map for seeding, validation), `issue-rules.ts` (`issueProblems`: kind allowed for the issuer's VAT status, ILS only, Hebrew only, not recorded, not cancelled, `documentProblems` clean), `vat-rates.ts` (effective-dated table; its single initial entry mirrors today's `VAT_RATE` and is marked unverified until Q17), `retention.ts` (`retainUntilYear`), `flags.ts`, `request-hash.ts`.
- **Tests:** `src/lib/__tests__/accounting-*.test.ts`: canonical form is stable under key order, Unicode forms and Decimal formatting; hash changes when any printed field changes; issue rules per kind and VAT status; flags default off.
- **Acceptance:** 100% of branches in `issue-rules.ts` covered.
- **Rollback:** revert. **Flags:** defines them. **Gate:** none.

### PR 1.6 Issue service and repository (no action, no UI)
- **Files:** `src/lib/accounting/issue.ts` (server-only `issueDocument(userId, invoiceId, idempotencyKey, actorUserId)`: idempotent replay → rules → one transaction: lock `User`, seed sequence, take number, insert document, lines, payments, secret, links, `AccountingEvent`, outbox rows; then the same side effects as recording a number: status, `linkDraftSessions`, `applyCreditNote`); `src/lib/accounting/repository.ts` (`getIssuedDocument`, `listIssuedDocuments`, `sequenceGaps`, `verifySnapshot`, all scoped by `userId`); `src/lib/billing-docs.ts` (the predicate gains `issuedDocument: { isNot: null }`).
- **Migration:** none.
- **Tests (`accounting-issue.db.test.ts`):**
  - **100 parallel issues** of 100 different drafts of one type and practice: numbers are exactly `start … start+99`, no duplicate, no gap.
  - 10 parallel calls with one idempotency key create one document and all return it; the same key with a different draft is refused; issuing an issued draft returns the existing document.
  - A failure forced after the number is taken rolls everything back; the next issue gets the same number.
  - Seeding: the first issue starts at `User.docNext*`; a second type starts at its own setting; two practices in parallel don't interfere.
  - Tenant: practice B can't issue, read or link A's drafts or documents.
  - **Income parity:** one draft issued, an identical draft in another practice recorded by hand; `loadIncome`, `loadOpenDocuments`, `loadCreditNoteRefunds` and the report period summaries are equal; a credit note issued for an issued invoice behaves like a recorded one.
  - `verifySnapshot` passes for every document created; tampering with a snapshot (with triggers disabled in the test) is detected.
- **Acceptance:** the service can only be called from tests; no exported action or route reaches it (isolation-coverage and write-lock tests unchanged).
- **Rollback:** revert. **Flags:** none (unreachable). **Gate:** none.

### PR 1.7 Outbox worker
- **Files:** `src/server/accounting-worker.ts` (claim with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED LIMIT n) RETURNING`, a lease in `lockedUntil`, exponential backoff, maximum attempts, handler registry), `src/instrumentation.ts` (start it only when `ACCOUNTING_WORKER_ENABLED`, like `startMaintenance`), `src/lib/accounting/outbox.ts` (enqueue with `dedupeKey`).
- **Tests (`accounting-outbox.db.test.ts`):** two workers in parallel never run one row twice; a handler that throws is retried with backoff and gives up after the limit with one sanitised `lastError` line; a crash mid-handler is re-claimed after the lease; the same `dedupeKey` never enqueues twice; no handler logs names, tax ids or amounts.
- **Acceptance:** with the flag off nothing starts (checked in a unit test of the start function).
- **Rollback:** revert. **Flags:** `ACCOUNTING_WORKER_ENABLED`. **Gate:** none.

### PR 1.8 Numbering settings, account closure, export, docs
- **Files:** `src/server/actions/settings.ts` (`updateDocumentNumberingAction` locks the `User` row, refuses types that have a sequence, writes `NUMBERING_SETTING_CHANGED` events for every change), `src/components/settings/document-numbering-card.tsx` (shows the sequence read-only when it exists), `src/app/(app)/settings/page.tsx`, `src/lib/account-closure-data.ts` (`purgeAccount` skips accounts with issued documents and logs once), the closure card and operator card text for that case, `src/lib/account-export.ts` (issued documents, lines, payments as CSV), `CLAUDE.md` (new "Accounting module" section: tables, triggers, flags, the issue path, the rules for touching write-once tables).
- **Tests:** `document-settings.db.test.ts` (refused after first issue, still free before); `account-closure.db.test.ts` (an account with an issued document is not purged, others are as before); `account-export.db.test.ts` (new files present).
- **Acceptance:** no production effect (no sequences exist yet).
- **Rollback:** revert. **Flags:** none. **Gate:** B8 for the final wording; the guard itself goes in regardless.

---

## Phase 2: receipt (קבלה) MVP

The smallest legal document, for both עוסק מורשה and עוסק פטור. Merged with flags off; enabled only for a test account on a non-production deployment until the gates clear.

### PR 2.1 Receipt content gaps
- **Files:** migration `…_document_address_cheque_due` (`Invoice.docClientAddress`, `Payment.chequeDueDate`, nullable, additive); `src/server/validators/billing-document.ts`; `src/lib/billing-docs.ts` (`documentProblems`: receipt needs a description, the payer's address unless the client card has one (CON-R-04, inferred), a due date for cheques; a warning when the payment date is far from today); `src/components/invoices/document-form.tsx` (address prefilled from the client, due date for cheques); `src/lib/accounting/issue-rules.ts`.
- **Tests:** `billing-docs.test.ts`, `document-form.db.test.ts`.
- **Acceptance:** drafts keep saving as before; only completeness rules for a finished document grow.
- **Rollback:** revert code; the columns stay (nullable). **Flags:** none. **Gate:** none.

### PR 2.2 `issueDocumentAction`
- **Files:** `src/server/actions/accounting.ts` (`issueDocumentAction(invoiceId, idempotencyKey)`: `requireUserId` → `isReadOnly` → flags, allowlist and the production registration-number check → zod → `issueDocument` → revalidate the document, lists, client, meetings, dashboard, reports); `src/server/__tests__/isolation-cases.ts` (new case); write-lock coverage.
- **Tests:** DB: issues a receipt, refuses other kinds for now, refuses with flags off, refuses a read-only account, Hebrew error texts; isolation three ways.
- **Acceptance:** with flags off the action answers "הפקת מסמכים עדיין לא זמינה" and changes nothing.
- **Rollback:** revert. **Flags:** `ACCOUNTING_ISSUE_ENABLED`, `ACCOUNTING_ISSUE_USERS`. **Gate:** none to merge; production enabling gated by B1, B8, registration and accountant sign-off (and B6 for exempt therapists).

### PR 2.3 Issue UI and issued-document view
- **Files:** `src/components/invoices/document-actions.tsx` and a new `issue-panel.tsx` (shown instead of `IssueComingSoon` when `ACCOUNTING_ENABLED`; lists what will be fixed; "הפקה" submits through `onSubmit` → `startTransition` with a key made once per panel by `crypto.randomUUID()`; double clicks reuse it); `document-view.tsx` and `document-preview.tsx` (an issued document renders from its snapshot via `loadIssuedDocumentView`); `src/app/api/invoices/[id]/pdf/route.tsx` (issued → `DocumentPDF` from the snapshot, marked as an unsigned copy, not an original, until phase 3: ED-04); the recorded-number box hidden for issued documents.
- **Tests:** `document-pdf.test.ts` renders an issued receipt from a snapshot; changing business details after issue changes nothing in its PDF; `document-look.test.ts` for the new notice.
- **Acceptance:** at 390 px and desktop, an issued receipt shows its number and cannot be edited, cancelled or re-recorded.
- **Rollback:** revert. **Flags:** `ACCOUNTING_ENABLED`. **Gate:** none to merge.

### PR 2.4 Lists, meetings, help
- **Files:** `src/lib/income-doc-list.ts` / `income-doc-rows.ts` (issued numbers, an "הופק במערכת" marker), client card and session page number display, `src/lib/help-articles.ts` (an article shown only when the flag is on).
- **Tests:** `income-doc-list.test.ts`, `income-doc-list.db.test.ts`.
- **Rollback:** revert. **Flags:** `ACCOUNTING_ENABLED`. **Gate:** none.

### Checkpoint 2.5 Accountant review (no code)
Sample receipts (made-up practice, both VAT statuses, every payment method) as PDFs and CSVs for the accountant. Outcome recorded in the matrix's sign-off column.

---

## Phase 3: PDF, signature and delivery

### PR 3.1 Stored artifacts
- **Files:** migration (`IssuedDocumentArtifact`, `IssuedDocumentArtifactBlob`, write-once triggers except the blob's ciphertext); `src/lib/accounting/artifacts.ts` (RENDER_ARTIFACT outbox handler: render from the snapshot with the pinned template version, "מסמך ממוחשב" (ED-02), store encrypted through `DocumentBlobStore`, record the plaintext sha256); `src/lib/reencrypt.ts` and `account-export.ts` include the blobs.
- **Tests:** rendering twice gives the same hash for the same template version; a corrupted blob is detected on read; RTL rules hold (`direction: "rtl"` on every `<Text>`).
- **Rollback:** revert; tables empty. **Flags:** `ACCOUNTING_WORKER_ENABLED`. **Gate:** none to merge.

### PR 3.2 Signing interface
- **Files:** `src/lib/accounting/signer.ts` (`DocumentSigner`: sign bytes → signed bytes + metadata; `UnsignedSigner` for development and tests, which never claims to sign); a real implementation only after Q1, in its own PR, with its key-storage provider (EU or Israel) named in the privacy policy.
- **Tests:** the pipeline stores signer metadata; an unsigned artifact is never labelled "מקור".
- **Gate:** **B2**.

### PR 3.3 Recipient consent
- **Files:** migration (`RecipientConsent`, append-only); client card section to record consent and withdrawal (how it is captured is Q23); issue and delivery read the latest event.
- **Tests:** DB: withdrawal stops electronic delivery; history kept; isolation case.
- **Gate:** Q23 for the capture method.

### PR 3.4 Original and copy
- **Files:** migration (`IssuedDocumentDelivery`); first delivery to the customer is the "מקור", every later output (including the therapist's own download) is "העתק" (OC-01, OC-02, OC-07).
- **Tests:** the second delivery is a copy; copies render from the same snapshot and template.
- **Gate:** none to merge.

### PR 3.5 Email delivery
- **Files:** DELIVER_EMAIL outbox handler (`sendEmail`, `docEmailSubject/Body` through `fillEmailTemplate`, the signed artifact attached), retries, delivery log; refuses without consent.
- **Tests:** a failed send is retried and never doubles; nothing is sent with the flag off.
- **Flags:** `ACCOUNTING_DELIVERY_ENABLED`. **Gate:** **B2**, ED-06.

### PR 3.6 Payment-method rule for secured signatures
- **Files:** `src/lib/accounting/delivery-rules.ts` (ED-07: which payment methods may go out electronically under a secured signature; the list stays empty for Bit, PayBox and cash until Q2), a print-and-sign path in the UI for the rest.
- **Tests:** unit tests per method.
- **Gate:** **B3**.

### PR 3.7 Notices for the therapist
- **Files:** letter templates (PDF) for the registered-mail notice before the first computerized document (ED-05) and the notice of where the books and backups are kept (LOC-06).
- **Gate:** Q3, Q4.

---

## Phase 4: other document types

| PR | Scope | Key files | Tests | Gate |
|---|---|---|---|---|
| 4.1 | **חשבונית מס (305)**: customer VAT number, "requested by the customer" flag, VAT rate from the effective-dated table, allocation guard by date (II-02) that blocks or warns above the threshold for an עוסק מורשה customer and points to the ITA service (II-16), splitting warning (II-08), template with "חשבונית מס", "עוסק מורשה", VAT wording (CON-TI-01..06) | `issue-rules.ts`, `src/lib/accounting/allocation-rules.ts`, form, template | Boundary dates 31.5/1.6.2026; zero VAT; private customer | Q17 for rates; accountant |
| 4.2 | **חשבונית מס/קבלה (320)**: "נפרע", payments must equal the total, own series (CON-TIR-01..03) | rules, template | Own numbering; mismatch refused | accountant |
| 4.3 | **חשבונית זיכוי (330)**: required `creditReason` (migration, nullable), referenced numbers and dates printed (CON-CN-02), CREDITS link, partial credits, record of how receipt was confirmed for VAT reduction (CON-CN-05), customer confirmation needs a certified signature for electronic copies (ED-08) | `issue.ts`, `billing-doc-data.ts`, form | Original untouched; income parity; double credit refused | Q10, Q18 |
| 4.4 | **Receipt paying a 305**: PAYS link, partial payments; today's `amountPaid` update moves into the issue transaction | `issue.ts`, `documents.ts` | Open debt equal to the recorded path | accountant |
| 4.5 | **חשבונית עסקה (300)**, only if confirmed | kinds, template, sequence | as above | **B6** (Q8) |
| 4.6 | **Foreign currency** (CON-LC-02): stored rate and ILS amounts in the snapshot; until then non-ILS stays refused | rules, snapshot | rounding | accountant |
| 4.7 | **Bilingual / English documents** (CON-LC-01) | templates | — | accountant |
| 4.8 | **Correcting an עוסק פטור's receipt** | per the answer | — | Q14 |

Each: rollback by revert; flags as in phase 2; isolation cases for any new action.

---

## Phase 5: uniform file and registration package

| PR | Scope | Key files | Tests | Gate |
|---|---|---|---|---|
| 5.1 | **Spec intake**: the v1.31 PDF transcribed field by field into `docs/accounting/uniform-v1.31.md` and typed constants; nothing invented; each field cites its page | `src/lib/accounting/uniform/v1_31/layout.ts` | Layout self-checks (lengths, positions) | none |
| 5.2 | **Exporter** (UF-01, UF-03..07): A100, C100, D110, D120, Z900; INI.TXT and zipped BKMVDATA.TXT in the required path; deterministic order; 15-digit primary id; INI 1006 from `SOFTWARE_REGISTRATION_NUMBER`; `UniformExport` table (migration) | `src/lib/accounting/uniform/*`, route `GET /api/accounting/uniform-export` | Golden files; totals reconcile to issued documents; tenant isolation | none |
| 5.3 | **Entry ≤ one step from the main menu** (UF-02) under /reports | reports page | UI check | `UNIFORM_EXPORT_ENABLED` |
| 5.4 | **Reports**: 2.6 printout, 5.4 summary (UF-09), Appendix E(א) ordered output with headers and end mark, sequence check (NUM-02), document locator (AUD-04) | `src/lib/accounting/reports/*`, PDFs | Golden files | none |
| 5.5 | **Simulator run** with a made-up practice of ≥ 2,000 records (UF-08); seed script in `scripts/accounting/`, never real data; results kept with the package | script, `docs/accounting/registration/` | — | Barak runs the upload |
| 5.6 | **Registration config and customer register**: certificate number and expiry warning (REG-10), operator's customer register export (REG-08), certificate copy shown to each customer (REG-06) | `src/lib/accounting/registration.ts`, admin card | Unit tests | none |
| 5.7 | **Registration package and submission** by the director through the ITA service | docs only | — | **B4**, **B5**, accountant |
| 5.8 | **Psychologist diary and appointment retention**: the Appendix ו' diary report (PSY-02); meetings of affected therapists no longer hard-deleted (soft delete, retention) | `src/lib/bulk-delete.ts`, `client-trash-data.ts`, `session-scope.ts`, diary report | DB tests for each delete path | **B9** (Q7, Q20); data-preserving migration needs approval |

---

## Phase 6: Tax Authority APIs

Built only from the official documents in the matrix (S9–S13, S15). No production call before the gate.

| PR | Scope | Key files | Tests | Gate |
|---|---|---|---|---|
| 6.1 | **Operator onboarding** (manual: personal area, corporate registration, digital authorisations, API software registration, developer-portal organisation and app, sandbox credentials) and the `TaxAuthorityGateway` interface with a fake | `src/lib/accounting/tax-authority/gateway.ts` | Fake-based tests | **B5**; credentials on Railway need approval |
| 6.2 | **OAuth per practice** (II-11, II-12): `TaxAuthorityConnection` (migration), connect and callback routes with state (and PKCE if the official flow supports it), encrypted rotating refresh token, a reminder before the 90-day expiry, disconnect | routes under `src/app/api/accounting/tax-authority/*`, `reencrypt.ts` | State mismatch, replay, expired and revoked tokens; isolation | `TAX_AUTHORITY_SANDBOX_ENABLED` |
| 6.3 | **Allocation numbers** (II-04..II-10): `AllocationRequest`, `AllocationNumber`; no DB lock held during a network call; ambiguous timeouts reconciled before any retry; the number attached by a copy, never by changing the original; refusal options | `allocation.ts` | Contract tests from official examples; timeout and duplicate handling | sandbox only |
| 6.4 | **Minimum amount** from `MinimumAmount` with the date table as fallback (II-02) | `allocation-rules.ts` | Fallback when the API fails | sandbox only |
| 6.5 | **Uniform-file transmission and status** (UF-10, UF-12) | `uniform/transmit.ts` | Contract tests | Q6; `TAX_AUTHORITY_PRODUCTION_ENABLED` only after customer-service approval (II-13) |

---

## Phase 7: launch readiness

| PR / step | Scope | Gate |
|---|---|---|
| 7.1 | **Books in Israel**: options paper (an Israeli region for the accounting data and backups, or the whole DB, versus a relief), then a data-preserving move with a tested rollback. Privacy policy and agreement updated | **B1**; Barak's approval for any infrastructure or data move |
| 7.2 | **Least-privilege DB role**: the app connects with `SELECT, INSERT` on write-once tables; migrations use a separate owner connection string | Environment change, Barak's approval |
| 7.3 | **Quarterly backup in Israel at a separate notified place** (LOC-02) and a restore drill that renders issued documents from the backup (LOC-03) | B1 |
| 7.4 | **Security and privacy review**; agreement, terms and privacy updated for retention after closure, Israeli hosting, the signing provider | **B8**; lawyer |
| 7.5 | **Product copy**: landing `GOOD_TO_KNOW` and `VIDEO_TEXT`, help articles, explainer video re-recorded (CLAUDE.md requires it when issuing goes live) | after the gates |
| 7.6 | **Moving over from morning or another system**: per-therapist runbook (starting numbers, last numbers in the old system, keeping old originals, notices) | **B7** |
| 7.7 | **Pilot**: one allowlisted account; daily sequence check, outbox lag and failure alerts in the logs; support runbook | all of the above, accountant sign-off |
| 7.8 | **Certificate and release discipline**: map the certificate to the software version; an "accounting edition" process for changes that count as a new version | **B4** |

---

## Open questions for the accountant and the lawyer

From the research report (Q1–Q12, its section 7), then from this audit (Q13–Q23).

**Signatures and delivery**
1. **Signing.** Can mirpaa hold one signing key per therapist on its servers (KMS/HSM) and have it count as the therapist's secured signature? Or must each therapist get a CA certificate? Can a company-level certificate be used at all? (Circular 24/2004 suggests the issuer's own signature.) *Lawyer.*
2. **Payment methods with a secured signature (18ב(ד)).** Do Bit, PayBox and bank-app transfers count as a direct transfer from the customer's bank account? How should cash-paid sessions be handled: a certified signature, or a paper original? *Accountant and lawyer.*
3. **Registered-mail notice (18ב(ב)).** Is the notice to the assessing officer before the first computerized document still enforced? Can mirpaa prepare it for each therapist? *Accountant.*
23. **Consent capture.** Is consent recorded by the therapist (the client agreed in person or on paper) enough, or must the client confirm electronically? *Lawyer.*

**Hosting, retention and records**
4. **Hosting outside Israel (25(א), 25(ו)(2)).** Is a relief under s.130(א)(2) realistic for a SaaS on non-Israeli cloud, or must the books DB and backups move to an Israeli region? Is moving only the accounting tables enough? What do therapists notify as the place of their books and backups? *Accountant and lawyer.*
13. **Retention after a therapist leaves.** Today closing an account deletes everything after 30 days, as the agreement promises. Who must hold her permanent file afterwards: may Mirpaa delete it once she has a full export (PDFs with signatures, the uniform file), or must Mirpaa keep it for the retention period, and on what terms? *Lawyer and accountant.*
20. **Appointments as books.** Given Appendix ו' section 4, may the app delete a psychologist's meetings (future meetings when a client stops, empty meetings, a client in the recycle bin after 30 days)? Does it matter whether a meeting took place or was billed? *Accountant.*
7. **Which bookkeeping appendix applies** to each type of therapist: do the diary and appointment rules of Appendix ו' also apply to social workers, art therapists, CBT therapists and others? *Accountant.*
12. **Privacy Protection (Data Security) Regulations 2017** for health data held in the same system as the books. *Lawyer.*

**Registration**
5. **New editions.** With continuous deployment, what counts as a new edition needing registration? Is there an accepted practice, such as registering major versions only, or separating the accounting module's releases? *Accountant; ask the registration desk.*
21. **The applicant.** Can מרום טכנולוגיות, an עוסק פטור, register as the software maker, or does it need to be a company (or a different status)? *Accountant.*
6. **Uniform-file transmission.** Is the production API live? From what date is it mandatory for new registrations and for existing users? *Ask lakohot-bt@taxes.gov.il or the registration desk.*
11. **White-label.** If mirpaa embedded a registered vendor's engine under its own brand, would it need its own registration? (Less relevant now that morning is removed, kept for completeness.) *Accountant.*

**Documents and numbering**
8. **עוסק פטור.** Is a receipt alone enough, or must a חשבונית עסקה also be issued (VAT Law s.45)? Is any wording required? *Accountant.*
14. **Cancelling an עוסק פטור's receipt.** What document corrects or cancels a receipt issued in error, when the business can't issue a credit note for VAT? *Accountant.*
15. **One receipt, several payment lines.** "A separate receipt for each payment": may one receipt list several payment lines received together (for example part cash, part card), as the app allows today? *Accountant.*
16. **Document date.** May a document's date be earlier than the last document of its type, or earlier or later than the day it is issued? Within what limits? *Accountant.*
9. **Migration.** Can a therapist moving from another provider start a new series at any number mid-year? Who keeps the old provider's signed originals for 7 years, and how? *Accountant.*
22. **Changing the next number after issuing.** Once the app has issued documents of a type, may the therapist raise the next number (leaving a gap), for example at the start of a tax year? *Accountant.*
18. **Cross-system references.** May a credit note or receipt issued in the app refer to an invoice issued in morning or another system? *Accountant.*
19. **External documents in the uniform file.** Must documents issued in another system before the move appear in the app's uniform-file export? *Accountant.*
10. **Credit notes to private patients.** Is reducing VAT practical when the customer's confirmation must be a signature, registered mail, fax or a certified e-signature? *Accountant.*
17. **VAT rates.** The research report does not state rates. Confirm the rate and effective dates the app must apply, and whether any of a therapist's services are zero-rated or exempt (the app supports only "by business type" or "exempt" per document). *Accountant.*

## Product decisions for Barak (not legal)

- Should a therapist whose Mirpaa subscription expired still be able to issue receipts? Today the write lock would block it; she can always read and download.
- Once issuing is live for a therapist, should the "record a number from another system" path stay available for the same document types?
- Is a print-and-sign path (paper original, no electronic delivery) acceptable as an interim answer to B2 and B3?
- Which provider and region for Israeli hosting (PR 7.1), and for signing keys (PR 3.2)?
