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

`createSessionAction` supports weekly/biweekly series: parent (RRULE in `recurrenceRule`) + children (`parentSessionId`). All create/update/reschedule paths run `findOverlaps` with an `allowOverlap` override.

- **"Only this meeting" vs "all of [client]'s following meetings"** on a date/time change, in both the calendar popup (`quickEditSessionAction`) and the full edit form (`updateSessionAction`), via `ApplyScopeChoice` (`applyScope=single|future`). It's shown only once the time actually changes and the client has followers. Followers are **not** tied to a series: many standing meetings were booked one by one. They're the client's SCHEDULED meetings after both the edited one and now, in the same **standing slot** (same clinic wall-clock weekday + start time) or the same series. Past, cancelled, completed and one-off meetings at other times never move. Each follower shifts by the same day offset and takes the new start/length. The pure rules live in `src/lib/standing-slot.ts` (tested, DST-safe) and the DB loading in `src/lib/session-scope.ts`. Overlaps are checked (and warned live: `checkOverlapAction` takes `applyScope`) across every moved slot, and reminders are rescheduled for each one. Calendar drag-and-drop deliberately stays single-meeting.
- **Deleting** (session page + popup, `DeleteSessionChoice`, in-page confirm, no `window.confirm`): "this meeting only" (`deleteSessionAction`, logs `NOTE_DELETE` if a note went with it) or "all future meetings of [client]" (`deleteClientFutureSessionsAction`, for a client who left). Bulk delete touches **only meetings starting after now**, and never deletes one holding a note, attachment, payment record, app invoice or Morning doc number: those are kept and set CANCELLED so no reminder goes out (`src/lib/bulk-delete.ts`). The counts are shown before confirming. It logs `SESSIONS_BULK_DELETE`, then lands on the client card with a result notice and an archive button.
- **`parentSessionId` is ON DELETE SET NULL**, so deleting a series' first meeting used to orphan the rest (no series anymore, no open-ended top-up). Every delete path now calls `keepSeriesLinked` first, which promotes the earliest surviving child to be the root. Statuses: SCHEDULED/COMPLETED/CANCELLED/NO_SHOW (UI label: "לא התקיימה"). Meeting types are user-defined (`MeetingType`, settings card) with optional **per-type calendar colors**.

- **Forms that can be refused submit by hand, not through `action=`.** React 19 resets every uncontrolled field after a form action runs, so a save refused for an overlap used to wipe the time, rate and note. `session-form.tsx`, `quick-edit-dialog.tsx` and `branding-card.tsx` use `onSubmit` → `preventDefault()` → `startTransition(() => formAction(new FormData(form)))`. Copy that for any form whose save can come back with an error.
- **Overlaps are warned live**: `checkOverlapAction` (read-only, same `findOverlaps` query) is called through `useOverlapWarning` 400 ms after the time stops changing, so the red note and the "אפשר חפיפה" box appear before saving. The save still runs its own check (and checks every slot of a new series, which the live check does not).
- **Moving a meeting's start re-applies the default length** (`defaultSessionMinutes`): the quick-edit end time becomes start + default (`addMinutesToTime`, capped at 23:59), and the edit form's duration resets to the default. Both stay editable.
- **Calendar month view must fit the screen without scrolling**: `fixedWeekCount={false}`, `dayMaxEvents` (fit what the cell holds, then "+N נוספים"), compact pill CSS, and the shell height `calc(100dvh - 9.5rem)`. Controls go in the FullCalendar toolbar (`customButtons`), never on a row of their own.
- **Israeli holidays** (`src/lib/holidays.ts`): fetched server-side from Hebcal (dates only, CC BY 4.0), cached in memory for a day, an empty map on failure. Shown via `dayCellContent`/`dayHeaderContent` (not as events, so they can't be dragged or opened) when `User.showHolidays` is on — the "☑ מועדי ישראל" toolbar button, saved per account.

### Billing: two parallel workflows

1. **Morning-first (the practitioner's actual workflow)**: billing happens in Morning (Green Invoice); the app records per-session payment status/method/amount (`paymentStatus` etc. on Session) and the practitioner types Morning document numbers onto the session — separate fields for חשבונית מס, קבלה, and the combined חשבונית מס-קבלה (`morningDocNumber`/`morningReceiptNumber`/`morningInvoiceReceiptNumber` + URL fields, auto-linked to synced Morning docs).
2. **App invoices**: sequential per-user numbering (`User.nextInvoiceNumber`, allocated in a transaction), one `InvoiceItem` per session max, `recordPaymentAction` recalculates totals atomically, PDF receipts via `@react-pdf/renderer` (Heebo fonts from `public/fonts` as data-URIs with lazy registration — fragile, check git history before touching). The PDF is a receipt, deliberately **not** a tax invoice.

Morning integration (`src/lib/morning.ts`): per-user API keys (secret encrypted like notes), sandbox/production base URLs (`morningSandbox` on User — sandbox has separate keys; mixing causes 401), token cache, receipt issuing (doc type 400, idempotent), and document sync into a general inbox for manual client assignment.

### Dashboards & follow-up surfaces

Dashboard shows **today's meetings** (clinic wall clock) with bold done/missing indicators for documentation and payment (`SessionFlags` component on other pages). `/document` lists recent meetings missing notes; `/collect` lists meetings with no payment update + open invoices. **Branding**: Settings → מיתוג sets `User.brandName` (shown under "מרפאה אישית") and `User.logoUrl` (replaces the "מ" tile) — a data: URL the browser crops/shrinks to 256px, validated server-side by `isValidLogoDataUrl`; the (app) layout reads both and passes them to `BrandMark` in the sidebar and mobile top bar. The clinic-room SVG illustration (`clinic-hero.tsx`) appears as the dashboard hero and as a letterhead banner on every other page (`clinic-banner.tsx`).

### Message import & inbox

`/import` parses pasted WhatsApp-style messages into clients/sessions (`src/lib/message-parse.ts`); `/api/inbox` ingests external messages by token (configured in Settings). Imported text can be appended to a session's encrypted note.

### Money, dates, RTL

Money is Prisma `Decimal` — no float math. Format money/dates only via `src/lib/format.ts`. Never parse datetime-local strings with `new Date()` on the server — use `src/lib/timezone.ts` (`fromZonedDateTimeLocal`/`toZonedDateTimeLocal`); the server runs in UTC. The layout is `dir="rtl"`: prefer logical properties (`ms-`/`me-`, `start`/`end`) and test positioned/translated elements — RTL flipping has caused drawer bugs (see mobile-top-bar comments).

## Deployment & data

Railway project **Clinic**: push to `main` auto-deploys service **psy-app**; start command runs `prisma migrate deploy`. The database is service **Postgres-EU** (Amsterdam, `europe-west4`) — chosen deliberately for privacy-law data locality; **do not** move data to non-EU regions. psy-app's `DATABASE_URL` references `${{Postgres-EU.DATABASE_URL}}`. The old US `Postgres` service was deleted on 2026-09-17 after psy-app was confirmed to reference `Postgres-EU` only; its final pre-migration dump is at `E:\psy-app-backups\psy-OLD-pre-migration-*.dump`. Nightly `pg_dump` backups run from the owner's machine (scheduled task `PsyAppDbBackup` → `E:\psy-app-backups`).

The production PWA is installed on the practitioner's iPhone — after every deploy she must fully close and reopen the app, or she'll report stale-client bugs ("stuck saving").
