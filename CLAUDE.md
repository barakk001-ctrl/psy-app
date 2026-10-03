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

Requires a `.env` (copy from `.env.example`): `DATABASE_URL` (Postgres), `AUTH_SECRET`, and `NOTES_ENCRYPTION_KEY` (base64, exactly 32 bytes — crypto.ts throws otherwise). `RESEND_API_KEY`/`EMAIL_FROM`/`CRON_SECRET` are optional (reminders degrade gracefully). Email/password registration in production is gated by `ALLOWED_EMAILS`; `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (optional) turn on Google sign-in.

## Architecture

### Mutations are server actions, not API routes

All business mutations live in `src/server/actions/*` (`"use server"` files): `clients`, `sessions`, `notes`, `invoices`, `payments`, `settings`, `auth`, `two-factor`, `files`, `inbox`, `meeting-types`, `morning-docs`, `todos`. The only API routes are `/api/auth/[...nextauth]`, `/api/cron/reminders` (Bearer `CRON_SECRET`), `/api/invoices/[id]/pdf`, `/api/clients/[id]/summaries` (a client's summaries as PDF, audit-logged `RECORD_EXPORT`), `/api/reports/income?from=&to=` (income report PDF), `/api/files/[id]` (session attachments), and `/api/inbox` (external message ingestion; GET with `?token=&message=` exists as an iOS-Shortcut-friendly fallback).

Every action follows the same pattern — copy it for new actions:
1. `requireUserId()` (local helper in each file: `auth()` → redirect/throw if no session)
2. Parse `FormData` through a Zod schema from `src/server/validators/*`
3. On validation failure, return `{ error: "<Hebrew message>", fieldErrors }` (state object consumed by `useActionState` forms)
4. Every DB query is scoped by `userId` — this is the entire authorization model (no roles; each user is an isolated practice owner)
5. `revalidatePath(...)` then usually `redirect(...)`

### Auth & security

Auth.js v5 beta (bcryptjs credentials + optional Google), JWT sessions, no DB adapter. Config split: `src/auth.config.ts` (edge-safe, used by `src/middleware.ts`: pages, pinned session cookie, `authorized`/`jwt`/`session` callbacks) vs `src/auth.ts` (Prisma, providers, Google `signIn`/`jwt` callbacks, Node-only). The middleware matcher **excludes `/api`** — API routes must guard themselves (`session?.user?.id` → 401). Route groups: `(auth)` = public login/register/forgot-password/reset-password + `/login/two-factor`; `(app)` = protected layout (sidebar + mobile top/tab bars + clinic banner).

Layered on top: **TOTP 2FA with backup codes** (`two-factor.ts`, settings card; the code check is `src/lib/second-factor.ts`, shared by both login paths), **Face ID / biometric lock overlay** for the installed PWA, password reset via email (`src/lib/password-reset.ts`), and **password change in Settings** (`changePasswordAction`: needs the current password, rate-limited per user, clears any pending reset link, audit-logged `PASSWORD_CHANGE`). Sessions are JWTs, so a change doesn't sign out other devices.

- **Who is signed in** is decided in one place, `src/lib/auth-gate.ts` (pure, tested): a token with `id` = user; a token with `pending2fa` = "2FA pending" (never a user, lapses after 10 min); anything else = guest. The `session` callback returns `user: null` for the last two — explicitly, because next-auth's server-side `auth()` otherwise falls back to the raw token as `user`. So **every guard must check `session?.user?.id`**, never just `session` or `session.user`. The middleware (`gateRequest`) sends a pending session to `/login/two-factor` from every page (server-action POSTs included); API routes 401 it via their `user.id` check.
- **Session cookie name is pinned** to `authjs.session-token` (`auth.config.ts` `cookies`). Auth.js would otherwise pick `__Secure-…` whenever `NEXTAUTH_URL` is https, and a rename signs everyone out. Don't change it.
- **Legal pages** (public, `gateRequest` lets both through): `/agreement` — the data-holding agreement (`src/lib/agreement.ts`, accepted at registration, versioned) — `/terms` — the terms of service (`src/lib/terms.ts`) — and `/privacy` — the privacy policy (`src/lib/privacy.ts`; must stay factual — e.g. both services run in the EU; if a region ever changes, update it: hosting regions, providers, cookies, backups). Both are drafts pending a lawyer's review; `/terms` holds `[להשלמה]` placeholders (operator details, VAT) and is not yet part of the registration acceptance. Keep the terms in step with the product (trial length, prices, no auto-renewal, read-only on expiry).
- **Registration**: all users are created by `createPracticeUser` (`src/lib/practice-user.ts`: lower-cased email, current agreement accepted, `TRIAL_DAYS` trial). Email/password registration is gated by `ALLOWED_EMAILS` in production (closed if unset); Google registration is **not** — anyone with a verified Google address may open a practice.
- **Google** (`AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`; provider and "המשך עם Google" buttons exist only when both are set — `isGoogleConfigured`). The `signIn` callback applies `decideGoogleSignIn` (`src/lib/google-auth.ts`, tested): requires `email_verified === true`; an existing user with that email (lower-cased) is signed in — that is the account linking, there is no Account table and never a second user per email; a new email is created only if the browser accepted the agreement — the register page's Google button (same form as the agreement checkbox) sets the 15-min `psy_google_agreement` cookie via `googleRegisterAction`; without it (e.g. from the login page) the user is sent to `/register?google=agreement`. New Google users get `hashedPassword: null` (nullable in the schema). The `jwt` callback mints a fresh token for our user (`tokenForGoogleUser`): with TOTP on it is **pending** (no `id`).
- **Pending 2FA → full session**: `/login/two-factor` → `verifyTwoFactorAction` → `signIn("two-factor")`, a second Credentials provider whose `authorize` takes the user from the current pending session (never the request body), rate-limits like the password login (`login:email:` 8/15 min shared bucket + `login:ip:` 25/15 min — inside `authorize`, so direct POSTs to the callback are limited too; throws `TwoFactorRateLimited`), and checks the TOTP/backup code. Success replaces the cookie with a normal token. The client-side session-update endpoint can't lift the pending state (the `jwt` callback ignores `trigger: "update"`).
- **Google-only accounts (no password)**: the password login answers "this account has no password — use Google or שכחת סיסמה?"; the reset-by-email flow sets a first password; Settings shows `sendSetPasswordLinkAction` ("שליחת קישור לקביעת סיסמה" to the account's own email) instead of the change-password form. A signed-in session alone can never set a password.
- Google sign-in errors land on `/login?error=…` (`pages.error`), shown in Hebrew. The Google callback URL is `<origin>/api/auth/callback/google`, where origin = `NEXTAUTH_URL` (which must be https in production).

### Encrypted clinical notes + audit log

`SessionNote` stores only AES-256-GCM ciphertext (`contentCiphertext`/`contentIv`/`contentTag`) — never plaintext. Encrypt/decrypt via `src/lib/crypto.ts` in server code only. Saving empty content deletes the note. Session file attachments are also stored encrypted (`files.ts`, `/api/files/[id]`).

**Every access to clinical content is audit-logged** (`src/lib/audit.ts` → `AuditLog` model): note view/save/append/delete and client-record views. AuditLog has deliberately **no FK relations** so entries outlive their subjects; logging is best-effort (failures never break the page). Users see their own log in Settings ("יומן גישה לרשומות"). Any new code path that decrypts or mutates a note must call `logAudit`.

### Reminder pipeline

`src/lib/reminders.ts` schedules `ReminderJob` rows (24h + 1h before each session) and is called from session create/update/status actions — it cancels/reschedules idempotently, so **any change to session times or status must go through these helpers**. The cron route claims due jobs (optimistic SENT flip), builds Hebrew HTML, sends via Resend (returns `{ok:false}` rather than throwing when unconfigured). `vercel.json` defines the cron (every 5 min).

### Sessions: recurring series, quick-edit, statuses

`createSessionAction` supports weekly/biweekly series: parent (RRULE in `recurrenceRule`) + children (`parentSessionId`). All create/update/reschedule paths run `findOverlaps` with an `allowOverlap` override.

- **Series length defaults to "קבוע — ללא תאריך סיום"** (open-ended) in the new-meeting form (`seriesMode` = `OPEN`; the form sends `openEnded=on` and no `occurrences`); "מספר פגישות מוגדר" (COUNT, 12 by default) is the other choice. An open series is created `OPEN_ENDED_BATCH` (26) meetings ahead with a rule without `COUNT=`, and the reminders cron tops it up (`topUpOpenEndedSeries`, `src/lib/series-topup.ts`). Whether a series is topped up is the pure `shouldTopUpSeries` (`recurrence.ts`, tested): open rule, client **ACTIVE**, at least one future SCHEDULED meeting left (none = ended deliberately, never resurrected), and the last meeting within `TOPUP_HORIZON_MS` (8 weeks).

- **"Only this meeting" vs "all of [client]'s following meetings"** on a date/time change, in both the calendar popup (`quickEditSessionAction`) and the full edit form (`updateSessionAction`), via `ApplyScopeChoice` (`applyScope=single|future`). It's shown only once the time actually changes and the client has followers. Followers are **not** tied to a series: many standing meetings were booked one by one. They're the client's SCHEDULED meetings after both the edited one and now, in the same **standing slot** (same clinic wall-clock weekday + start time) or the same series. Past, cancelled, completed and one-off meetings at other times never move. Each follower shifts by the same day offset and takes the new start/length. The pure rules live in `src/lib/standing-slot.ts` (tested, DST-safe) and the DB loading in `src/lib/session-scope.ts`. Overlaps are checked (and warned live: `checkOverlapAction` takes `applyScope`) across every moved slot, and reminders are rescheduled for each one. Calendar drag-and-drop deliberately stays single-meeting.
- **Deleting** (session page + popup, `DeleteSessionChoice`, in-page confirm, no `window.confirm`): "this meeting only" (`deleteSessionAction`, logs `NOTE_DELETE` if a note went with it) or "all future meetings of [client]" (`deleteClientFutureSessionsAction`, for a client who left). Bulk delete touches **only meetings starting after now**, and never deletes one holding a note, attachment, payment record, app invoice or Morning doc number: those are kept and set CANCELLED so no reminder goes out (`src/lib/bulk-delete.ts`). The counts are shown before confirming. It logs `SESSIONS_BULK_DELETE`, then lands on the client card with a result notice and the פעיל/לא פעיל toggle.
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

### Clients: one status

`ClientStatus` is just ACTIVE / INACTIVE (פעיל / לא פעיל). There used to be a third, ARCHIVED ("מאוחסן"), which only hid a client from lists — the practitioner couldn't tell it from inactive, so migration `20260928000000_merge_archived_into_inactive` turned every archived client into inactive and dropped the value. Status is switched from the client card (`ClientStatusToggle`), the row button on the clients list (`ClientStatusMoveButton`; tabs פעילים / לא פעילים; `?view=archived` still maps to inactive) — both via `setClientStatusAction` — or the edit form's status field (`updateClientAction`). Inactive clients keep their history (past meetings, summaries, invoices); they're left out of the calendar/new-meeting pickers (except when the meeting is booked from their own card) but stay selectable for invoices, message import and Morning-doc assignment (listed after active ones).

**Active → inactive takes the client's future meetings off the calendar** (rules in `src/lib/client-deactivation.ts`, tested; DB loading `loadDeactivationPlan` in `session-scope.ts`). It reuses the bulk-delete safety rules: only meetings starting after now and not already CANCELLED; empty ones are deleted, ones holding a note, attachment, payment record, app invoice or Morning doc number are kept and set CANCELLED (only SCHEDULED ones — a future meeting already marked done/no-show keeps its status), with `cancelSessionReminders` for each (deleted ones' jobs cascade). The client's open-ended series are closed (`closeRecurrenceRule` adds `COUNT=<meetings left>`) so the cron never extends them, and the top-up also skips inactive clients. Everything runs in one transaction with the status change (`saveClient` in `clients.ts`), logs `SESSIONS_BULK_DELETE`, and lands on the card's bulk-delete result notice (`?futureDeleted=&futureKept=&keptWhy=`). **It asks first**: when meetings would be affected, the action does not save but returns `{ confirm: { count, notice } }` (edit form: `state.deactivate`), e.g. "יוסרו 8 פגישות עתידיות מהיומן (2 שיש בהן תיעוד/תשלום יישמרו כמבוטלות)."; all three entry points show it in-page (`DeactivationConfirmPanel`, no `window.confirm`) and resubmit with `confirmDeactivate=<count>`. If more meetings appeared since, it asks again (`needsDeactivationConfirm`); with nothing on the calendar it just switches. An old client that never sends the confirmation can therefore never delete anything. Inactive → active changes nothing on the calendar (deleted meetings don't come back; she books again). The client form submits via `onSubmit` → `startTransition` so a refused save keeps what was typed.

The client card splits meetings into פגישות עתידיות / פגישות שהתקיימו / בוטלו-לא התקיימו (`SessionList`). "Took place" = COMPLETED, or SCHEDULED whose time has passed (`tookPlace` in `src/lib/income.ts`) — most meetings are never marked completed.

### Income numbers (dashboard, reports, income PDF)

One set of rules in `src/lib/income.ts` (pure, tested in `income.test.ts`) + `income-data.ts` (DB) + `report-periods.ts` (periods, summary): **received** = app-invoice `Payment`s (dated `paidAt`) + meetings marked PAID without an app invoice (dated by the meeting; no amount typed → the rate); **expected** = rates of SCHEDULED + COMPLETED meetings. Periods follow the clinic calendar (`clinicMonthRange`), not the UTC server clock. The reports page used to read only `Payment` rows, so a Morning-first practice saw ₪0 everywhere — never compute income anywhere else. There is no expenses model.

### PDFs with Hebrew (`@react-pdf/renderer`)

Besides the invoice PDF: the summaries and income-report PDFs use `components/pdf/rtl-text.tsx` and `pdf-response.ts` (reuses the invoice PDF's lazy Heebo registration). Verified rules: `direction: "rtl"` must be on **every** `<Text>` (it is not inherited from the Page — without it wrapped lines holding English/numbers come out with their halves swapped), and never put `\n` inside a `<Text>` (it corrupts that line's glyphs) — split lines into separate `<Text>`s (`RParagraphs`). Cells like "02.09.26 12:00" get `direction: "ltr"`. Buttons use `PdfButton` (`components/ui/pdf-button.tsx`), which hands the file to the share sheet in the installed PWA.

### Dashboards & follow-up surfaces

Dashboard shows **today's meetings** (clinic wall clock) with bold done/missing indicators for documentation and payment (`SessionFlags` component on other pages). `/document` lists recent meetings missing notes; `/collect` lists meetings with no payment update + open invoices. **Branding**: Settings → מיתוג sets `User.brandName` (shown under "מרפאה אישית") and `User.logoUrl` (replaces the "מ" tile) — a data: URL the browser crops/shrinks to 256px, validated server-side by `isValidLogoDataUrl`; the (app) layout reads both and passes them to `BrandMark` in the sidebar and mobile top bar; the logo also shows in a small circle (`LogoAvatar`) beside the "שלום, …" greeting on the dashboard and in the letterhead banner. The clinic-room SVG illustration (`clinic-hero.tsx`) appears as the dashboard hero and as a letterhead banner on every other page (`clinic-banner.tsx`).

### Subscriptions

`src/lib/subscription.ts`: 30-day trial, then MONTHLY/YEARLY (`PRICING`); an expired account is read-only, never locked out. Card payments via Grow (`src/lib/billing.ts`) only once `GROW_USER_ID`/`GROW_PAGE_CODE` are set. `isAdmin` users see the subscriptions card in Settings (extend, exempt). **Only Barak (barakk001@gmail.com) is admin** — migration `20261003120000_single_admin` turned every other admin (Keren) into a non-admin, exempt user. Admin rights are changed by migration, not from the UI.

### Message import & inbox

`/import` parses pasted WhatsApp-style messages into clients/sessions (`src/lib/message-parse.ts`); `/api/inbox` ingests external messages by token (configured in Settings). Imported text can be appended to a session's encrypted note.

### Money, dates, RTL

Money is Prisma `Decimal` — no float math. Format money/dates only via `src/lib/format.ts`. Never parse datetime-local strings with `new Date()` on the server — use `src/lib/timezone.ts` (`fromZonedDateTimeLocal`/`toZonedDateTimeLocal`); the server runs in UTC. The layout is `dir="rtl"`: prefer logical properties (`ms-`/`me-`, `start`/`end`) and test positioned/translated elements — RTL flipping has caused drawer bugs (see mobile-top-bar comments).

## Deployment & data

Railway project **Clinic**: push to `main` auto-deploys service **psy-app**; start command runs `prisma migrate deploy`. The database is service **Postgres-EU** (Amsterdam, `europe-west4`), and since 2026-09-30 the **psy-app service runs in the EU too** (`europe-west4-drams3a`; it was in `us-east4`, so every query crossed the Atlantic) — chosen deliberately for privacy-law data locality; **do not** move data to non-EU regions. psy-app's `DATABASE_URL` references `${{Postgres-EU.DATABASE_URL}}`. The old US `Postgres` service was deleted on 2026-09-17 after psy-app was confirmed to reference `Postgres-EU` only; its final pre-migration dump is at `E:\psy-app-backups\psy-OLD-pre-migration-*.dump`. Nightly `pg_dump` backups run from the owner's machine (scheduled task `PsyAppDbBackup` → `E:\psy-app-backups`).

The production PWA is installed on the practitioner's iPhone — after every deploy she must fully close and reopen the app, or she'll report stale-client bugs ("stuck saving").
