# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"מרפאה" — a Next.js 15 (App Router) practice-management app for solo psychologists: clients, calendar sessions, encrypted clinical notes, per-meeting payments, invoices, PDF receipts, email reminders, reports, message import, PWA. **Hebrew-first, RTL everywhere.** All UI strings, form errors, and emails are Hebrew; locale is hard-coded `he-IL`, timezone `Asia/Jerusalem`, currency ILS. Multi-tenant by design: each user is an isolated practice owner (the app is being prepared for use by several psychologists under one deployment).

## Commands

```bash
npm run dev              # dev server (http://localhost:3000)
npm run build            # prisma generate + next build
npm run lint             # eslint
npm run db:migrate       # create + apply a migration in dev (migrations are committed in prisma/migrations/)
npm run db:studio        # Prisma Studio
npm run db:generate      # regenerate Prisma client after schema changes
npm test                 # Vitest — pure-logic tests in src/**/__tests__ (no DB needed)
```

CI (`.github/workflows/ci.yml`) runs lint, tsc, tests, and build on pushes/PRs to main. Testable logic lives in `src/lib` as pure functions — server actions import them; put new business rules there, not inline in actions.

Requires a `.env` (copy from `.env.example`): `DATABASE_URL` (Postgres), `AUTH_SECRET`, and `NOTES_ENCRYPTION_KEY` (base64, exactly 32 bytes — crypto.ts throws otherwise). `RESEND_API_KEY`/`EMAIL_FROM`/`CRON_SECRET` are optional (reminders degrade gracefully). Registration in production is gated by `ALLOWED_EMAILS`.

## Architecture

### Mutations are server actions, not API routes

All business mutations live in `src/server/actions/*` (`"use server"` files): `clients`, `sessions`, `notes`, `invoices`, `payments`, `settings`, `auth`, `two-factor`, `files`, `inbox`, `meeting-types`, `morning-docs`, `todos`. The only API routes are `/api/auth/[...nextauth]`, `/api/cron/reminders` (Bearer `CRON_SECRET`), `/api/invoices/[id]/pdf`, `/api/files/[id]` (session attachments), and `/api/inbox` (external message ingestion; GET with `?token=&message=` exists as an iOS-Shortcut-friendly fallback).

Every action follows the same pattern — copy it for new actions:
1. `requireUserId()` (local helper in each file: `auth()` → redirect/throw if no session)
2. Parse `FormData` through a Zod schema from `src/server/validators/*`
3. On validation failure, return `{ error: "<Hebrew message>", fieldErrors }` (state object consumed by `useActionState` forms)
4. Every DB query is scoped by `userId` — this is the entire authorization model (no roles; each user is an isolated practice owner)
5. `revalidatePath(...)` then usually `redirect(...)`

### Auth & security

Auth.js v5 beta (credentials only, bcryptjs), JWT sessions. Config split: `src/auth.config.ts` (edge-safe, used by `src/middleware.ts`) vs `src/auth.ts` (Prisma + credentials, Node-only). The middleware matcher **excludes `/api`** — API routes must guard themselves. Route groups: `(auth)` = public login/register/forgot-password/reset-password; `(app)` = protected layout (sidebar + mobile top/tab bars + clinic banner).

Layered on top: **TOTP 2FA with backup codes** (`two-factor.ts`, settings card), **Face ID / biometric lock overlay** for the installed PWA, and password reset via email.

### Encrypted clinical notes + audit log

`SessionNote` stores only AES-256-GCM ciphertext (`contentCiphertext`/`contentIv`/`contentTag`) — never plaintext. Encrypt/decrypt via `src/lib/crypto.ts` in server code only. Saving empty content deletes the note. Session file attachments are also stored encrypted (`files.ts`, `/api/files/[id]`).

**Every access to clinical content is audit-logged** (`src/lib/audit.ts` → `AuditLog` model): note view/save/append/delete and client-record views. AuditLog has deliberately **no FK relations** so entries outlive their subjects; logging is best-effort (failures never break the page). Users see their own log in Settings ("יומן גישה לרשומות"). Any new code path that decrypts or mutates a note must call `logAudit`.

### Reminder pipeline

`src/lib/reminders.ts` schedules `ReminderJob` rows (24h + 1h before each session) and is called from session create/update/status actions — it cancels/reschedules idempotently, so **any change to session times or status must go through these helpers**. The cron route claims due jobs (optimistic SENT flip), builds Hebrew HTML, sends via Resend (returns `{ok:false}` rather than throwing when unconfigured). `vercel.json` defines the cron (every 5 min).

### Sessions: recurring series, quick-edit, statuses

`createSessionAction` supports weekly/biweekly series: parent (RRULE in `recurrenceRule`) + children (`parentSessionId`). The calendar popup (`quick-edit-dialog.tsx` → `quickEditSessionAction`) offers **series-wide time changes**: "this meeting only" or "this and all future in the series" (a date move also shifts the weekday; overlaps are checked across all shifted slots). All create/update/reschedule paths run `findOverlaps` with an `allowOverlap` override. Statuses: SCHEDULED/COMPLETED/CANCELLED/NO_SHOW (UI label: "לא התקיימה"). Meeting types are user-defined (`MeetingType`, settings card) with optional **per-type calendar colors**.

### Billing: two parallel workflows

1. **Morning-first (the practitioner's actual workflow)**: billing happens in Morning (Green Invoice); the app records per-session payment status/method/amount (`paymentStatus` etc. on Session) and the practitioner types Morning document numbers onto the session — separate fields for חשבונית מס, קבלה, and the combined חשבונית מס-קבלה (`morningDocNumber`/`morningReceiptNumber`/`morningInvoiceReceiptNumber` + URL fields, auto-linked to synced Morning docs).
2. **App invoices**: sequential per-user numbering (`User.nextInvoiceNumber`, allocated in a transaction), one `InvoiceItem` per session max, `recordPaymentAction` recalculates totals atomically, PDF receipts via `@react-pdf/renderer` (Heebo fonts from `public/fonts` as data-URIs with lazy registration — fragile, check git history before touching). The PDF is a receipt, deliberately **not** a tax invoice.

Morning integration (`src/lib/morning.ts`): per-user API keys (secret encrypted like notes), sandbox/production base URLs (`morningSandbox` on User — sandbox has separate keys; mixing causes 401), token cache, receipt issuing (doc type 400, idempotent), and document sync into a general inbox for manual client assignment.

### Dashboards & follow-up surfaces

Dashboard shows **today's meetings** (clinic wall clock) with bold done/missing indicators for documentation and payment (`SessionFlags` component on other pages). `/document` lists recent meetings missing notes; `/collect` lists meetings with no payment update + open invoices. The clinic-room SVG illustration (`clinic-hero.tsx`) appears as the dashboard hero and as a letterhead banner on every other page (`clinic-banner.tsx`).

### Message import & inbox

`/import` parses pasted WhatsApp-style messages into clients/sessions (`src/lib/message-parse.ts`); `/api/inbox` ingests external messages by token (configured in Settings). Imported text can be appended to a session's encrypted note.

### Money, dates, RTL

Money is Prisma `Decimal` — no float math. Format money/dates only via `src/lib/format.ts`. Never parse datetime-local strings with `new Date()` on the server — use `src/lib/timezone.ts` (`fromZonedDateTimeLocal`/`toZonedDateTimeLocal`); the server runs in UTC. The layout is `dir="rtl"`: prefer logical properties (`ms-`/`me-`, `start`/`end`) and test positioned/translated elements — RTL flipping has caused drawer bugs (see mobile-top-bar comments).

## Deployment & data

Railway project **Clinic**: push to `main` auto-deploys service **psy-app**; start command runs `prisma migrate deploy`. The database is service **Postgres-EU** (Amsterdam, `europe-west4`) — chosen deliberately for privacy-law data locality; **do not** move data to non-EU regions. psy-app's `DATABASE_URL` references `${{Postgres-EU.DATABASE_URL}}`. An old `Postgres` service (US) may still exist as a frozen pre-migration copy — do not write to it. Nightly `pg_dump` backups run from the owner's machine (scheduled task `PsyAppDbBackup` → `E:\psy-app-backups`).

The production PWA is installed on the practitioner's iPhone — after every deploy she must fully close and reopen the app, or she'll report stale-client bugs ("stuck saving").
