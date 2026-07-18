# Project Review — Recommendations & Roadmap

**Reviewed:** 2026-07-18
**Verdict:** A cohesive, feature-complete v1 for a solo Hebrew-speaking practitioner. Clients, calendar, encrypted clinical notes, invoices/payments, PDF receipts, email reminders, and reports all work end-to-end. The gaps below are prioritized: fix the foundations first, then ship the features that are already half-scaffolded in the schema.

---

## 1. Critical fixes (do these first)

> ✅ **All six items in this section were implemented on 2026-07-18** (allowlist registration, committed migrations, error/loading boundaries, rate limiting, payment fixes, cron reclaim). Kept below for reference.

### 1.1 Close open registration
`/register` lets **anyone** create an account on a clinical app that stores patient data. Options, simplest first:
- Add an `ALLOWED_EMAILS` / invite-code env check in `registerAction`.
- Or disable the route entirely in production and seed the practitioner account manually.
- Longer-term: email verification via Resend (you already have it wired).

### 1.2 Commit Prisma migrations
`prisma/migrations/` doesn't exist, but `railway.json` runs `npx prisma migrate deploy` on start — which applies nothing. A fresh deploy has no tables until someone manually runs `migrate dev`. Run once locally:
```bash
npx prisma migrate dev --name init
```
and commit the folder. Then remove the manual-migration workaround from `DEPLOY_RAILWAY.md`.

### 1.3 Add error & loading boundaries
There is no `error.tsx`, `loading.tsx`, or `not-found.tsx` anywhere under `src/app`. Any DB/server-action failure surfaces as a raw crash page. Add at minimum:
- `src/app/(app)/error.tsx` — friendly Hebrew error with a retry button
- `src/app/(app)/loading.tsx` — skeleton for the sidebar layout
- `src/app/not-found.tsx`

### 1.4 Rate-limit login and register
No brute-force protection on credentials auth. Add a simple in-memory/DB-backed limiter (e.g. 5 attempts per email per 15 min) in `signIn`/`registerAction`. On a single-instance Railway deploy, an in-process `Map` is fine to start.

### 1.5 Payment logic bugs
- **Overpayment:** `recordPaymentAction` doesn't cap the amount against the remaining balance — any amount flips the invoice to PAID. Validate `amount <= total - amountPaid`.
- **Cancelled-invoice resurrection:** `deletePaymentAction` (`src/server/actions/payments.ts:118`) recalculates status as `DRAFT ? DRAFT : SENT`, so deleting a payment from a CANCELLED invoice revives it. Preserve CANCELLED.

### 1.6 Reminder cron: claim-before-send
The cron marks a `ReminderJob` SENT *before* actually sending; a crash between claim and send silently loses the reminder. Either mark `PROCESSING` with a timeout-based reclaim, or accept rare double-sends and claim after a successful send.

---

## 2. High-value improvements

### 2.1 Double-booking prevention ✅ implemented 2026-07-18
`createSessionAction` / `rescheduleSessionAction` allow overlapping sessions. Check for conflicts (`startsAt < newEnd AND endsAt > newStart`, status SCHEDULED) and warn or block. The calendar drag-and-drop path especially needs this.

### 2.2 Pagination / search
Clients, invoices, and the calendar query are unbounded `findMany`s. Fine today, painful at a few hundred records:
- Clients: server-side search by name/phone + cursor pagination (or at least `take: 100` + a search box).
- Invoices: paginate + filter by status/date range.
- Calendar already windows -60d…+180d — acceptable, but consider fetching per visible range via FullCalendar's `datesSet`.

### 2.3 Encrypt remaining PII
Only clinical notes are encrypted. `idNumber` (ת.ז), `dateOfBirth`, `address`, and `generalNotes` are plaintext — the schema comment at `prisma/schema.prisma:58` already anticipates encrypting `idNumber`. Reuse `src/lib/crypto.ts` for at least `idNumber` and `generalNotes`. (Trade-off: encrypted fields aren't searchable — keep names/phone plaintext for search.)

### 2.4 Basic test coverage + CI ✅ implemented 2026-07-18 (Vitest, 30 tests, GitHub Actions)
Zero tests today. Highest-ROI targets (pure logic, no mocking pain):
- `src/lib/crypto.ts` — round-trip, tamper detection
- `src/lib/reminders.ts` — scheduling/cancellation idempotency
- Payment status recalculation (extract to a pure function first)
- Invoice numbering under concurrency
Suggested stack: Vitest + a GitHub Actions workflow running `lint`, `tsc --noEmit`, and tests.

### 2.5 Security headers
`next.config.ts` is empty. Add standard headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a CSP (report-only first).

### 2.6 Audit log
For a clinical app, record who viewed/edited notes and client records (a simple `AuditLog` model: userId, action, entity, entityId, timestamp). Cheap to add now, very hard to retrofit, and relevant to Israeli privacy-regulation expectations for health data.

---

## 3. New features (roughly in order of value)

### 3.1 Recurring sessions ✅ implemented 2026-07-18 (weekly/biweekly series, delete-future)
The schema has full RRULE support (`recurrenceRule`, `parentSessionId`, child relation) but no code uses it. Weekly recurring appointments are the bread and butter of therapy practices — this is the single highest-value feature. Implement with the `rrule` npm package: create N future instances (e.g. 12 weeks ahead), "edit this / edit all future" semantics, and a background top-up when instances run low.

### 3.2 Client portal / self-scheduling (v2)
A public booking page per practitioner: available slots derived from working hours minus existing sessions, client picks a slot → session created as pending-confirmation. Big differentiator; needs the double-booking check (2.1) first.

### 3.3 WhatsApp/SMS reminders ✅ wa.me link implemented 2026-07-18 (Twilio API automation still open)
`ReminderChannel.SMS` is in the schema. In Israel, **WhatsApp is far more effective than email** for appointment reminders. Options: Twilio WhatsApp API, or the simpler interim step — a "send reminder" button that opens `wa.me/<phone>?text=<prefilled Hebrew message>` for manual sending (zero cost, no API approval).

### 3.4 Invoice emailing ✅ implemented 2026-07-18 (stored PDFs still open)
`Invoice.pdfUrl` exists but is unused, and no invoice email exists. Add "send invoice to client" via Resend with the PDF attached, and optionally store rendered PDFs (S3/Railway volume) for immutable records.

### 3.5 Tax-compliant invoicing via provider ✅ Morning integration scaffold implemented 2026-07-18 (connect in Settings; receipts from invoices; income sync still open)
The PDF footer explicitly says "not a tax invoice." Integrate Green Invoice / Morning / EZCount API to issue real חשבונית מס/קבלה, keeping your app as the source of truth. This turns the app from a tracker into a complete business tool.

### 3.6 Cancellation policy & no-show billing
Sessions have a NO_SHOW status but nothing happens with it. Add: per-client cancellation policy (e.g. <24h = charged), automatic flagging of billable no-shows in the invoice-creation flow, and a no-show count on the client page.

### 3.7 Session-note improvements
- Note templates (SOAP / intake / progress formats)
- Note history/versioning (append-only, fits the audit-log work)
- A "notes due" indicator: completed sessions without a note on the dashboard

### 3.8 Working-hours & availability settings
Calendar slots are hardcoded 07:00–22:00. Add per-user working hours and blocked times (vacations) in Settings; feeds directly into 3.2.

### 3.9 Data export & backup
- CSV export for clients/invoices/payments (accountant-friendly)
- Full JSON export ("my data") — important for trust and data-portability obligations
- Documented DB backup strategy for Railway Postgres

### 3.10 Waitlist & client tags
Small quality-of-life wins: a waitlist for popular slots; free-form tags on clients (CBT, couples, child…) with filtering.

---

## 4. Cleanups (low effort)

| Item | Where |
|---|---|
| README structure section calls implemented pages "stubs" | `README.md:120` |
| Deploy doc claims PDF fonts load from jsDelivr (now local) | `DEPLOY_RAILWAY.md:116` |
| Dead code: `ComingSoon` component | `src/components/ui/coming-soon.tsx` |
| `Client.intakeDate` field exists but missing from form/validator | `src/server/validators/client.ts`, client form |
| Mixed Auth.js v4/v5 env names (`NEXTAUTH_URL` vs `AUTH_*`) | `.env.example`, deploy docs |
| Unused columns: `User.logoUrl`, `Payment.provider/providerTxId` | keep (future features) or note as reserved |

---

## 5. Suggested sequencing

1. **Week 1 — hardening:** migrations committed (1.2), registration closed (1.1), error/loading pages (1.3), payment bugs (1.5), rate limiting (1.4).
2. **Week 2 — recurring sessions (3.1)** + double-booking check (2.1) + working hours (3.8).
3. **Week 3 — communications:** invoice email + stored PDFs (3.4), WhatsApp reminder link (3.3).
4. **Then:** tests + CI (2.4) as an ongoing habit, PII encryption (2.3), audit log (2.6), and the bigger bets — client portal (3.2) and tax-provider integration (3.5).
