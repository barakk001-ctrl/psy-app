# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"מרפאה" — a Next.js 15 (App Router) practice-management app for a solo psychologist: clients, calendar sessions, encrypted clinical notes, invoices/payments, PDF receipts, email reminders, reports. **Hebrew-first, RTL everywhere.** All UI strings, form errors, and emails are Hebrew; locale is hard-coded `he-IL`, timezone `Asia/Jerusalem`, currency ILS.

## Commands

```bash
npm run dev              # dev server (http://localhost:3000)
npm run build            # prisma generate + next build
npm run lint             # eslint
npm run db:migrate       # create + apply a migration in dev (migrations are committed in prisma/migrations/)
npm run db:studio        # Prisma Studio
npm run db:generate      # regenerate Prisma client after schema changes
```

```bash
npm test                 # Vitest — pure-logic tests in src/**/__tests__ (no DB needed)
```

CI (`.github/workflows/ci.yml`) runs lint, tsc, tests, and build on pushes/PRs to main. Testable logic lives in `src/lib` as pure functions (e.g. `invoice-status.ts`, `recurrence.ts`, `whatsapp.ts`, `rate-limit.ts`) — server actions import them; put new business rules there, not inline in actions.

Requires a `.env` (copy from `.env.example`): `DATABASE_URL` (Postgres), `AUTH_SECRET`, and `NOTES_ENCRYPTION_KEY` (base64, exactly 32 bytes — crypto.ts throws otherwise). `RESEND_API_KEY`/`EMAIL_FROM`/`CRON_SECRET` are optional (reminders degrade gracefully).

Test the reminder cron locally: `curl -X POST http://localhost:3000/api/cron/reminders`.

## Architecture

### Mutations are server actions, not API routes

All business mutations live in `src/server/actions/*` (`"use server"` files): `clients.ts`, `sessions.ts`, `notes.ts`, `invoices.ts`, `payments.ts`, `settings.ts`, `auth.ts`. The only API routes are `/api/auth/[...nextauth]`, `/api/cron/reminders` (Bearer `CRON_SECRET`), and `/api/invoices/[id]/pdf`.

Every action follows the same pattern — copy it for new actions:
1. `requireUserId()` (local helper in each file: `auth()` → redirect to `/login` if no session)
2. Parse `FormData` through a Zod schema from `src/server/validators/*`
3. On validation failure, return `{ error: "<Hebrew message>", fieldErrors }` (state object consumed by `useActionState` forms)
4. Every DB query is scoped by `userId` — this is the entire authorization model (no roles; each user is an isolated practice owner)
5. `revalidatePath(...)` then usually `redirect(...)`

### Auth

Auth.js v5 beta (credentials only, bcryptjs), JWT sessions. Config is split: `src/auth.config.ts` (edge-safe, used by `src/middleware.ts`) vs `src/auth.ts` (adds Prisma + credentials provider, Node-only). The middleware matcher **excludes `/api`** — API routes must guard themselves.

Route groups: `src/app/(auth)` = public login/register layout; `src/app/(app)` = protected sidebar layout.

### Encrypted clinical notes

`SessionNote` stores only AES-256-GCM ciphertext (`contentCiphertext`/`contentIv`/`contentTag`) — never plaintext. Encrypt/decrypt via `src/lib/crypto.ts` in server actions only. Saving empty content deletes the note. Other client PII (idNumber, address, generalNotes) is currently plaintext.

### Reminder pipeline

`src/lib/reminders.ts` schedules `ReminderJob` rows (24h + 1h before each session) and is called from session create/update/status actions — it cancels/reschedules idempotently, so **any change to session times or status must go through these helpers**. The cron route claims due jobs (optimistic SENT flip), builds Hebrew HTML from `src/lib/reminder-email.ts`, sends via `src/lib/email.ts` (Resend; returns `{ok:false}` rather than throwing when unconfigured).

### Invoices & payments

Invoice numbers are sequential per user (`User.nextInvoiceNumber`), allocated inside a transaction in `createInvoiceAction`. One `InvoiceItem` per session max (`sessionId` unique). `recordPaymentAction`/`deletePaymentAction` recalculate `amountPaid` and invoice status atomically. PDF receipts render on the fly with `@react-pdf/renderer` (`src/components/invoices/invoice-pdf.tsx`) — Heebo fonts load from `public/fonts/*.ttf` as data-URIs with lazy registration (this was fragile; see recent git history before touching it). The PDF is a receipt, deliberately **not** a tax invoice.

### Money and dates

Money is Prisma `Decimal` — don't do float math on it. Format money/dates only via `src/lib/format.ts`.

### RTL gotcha

The layout is `dir="rtl"`. Directional CSS has caused bugs before (drawer transform needed an explicit inline style to bypass RTL flipping) — prefer logical properties (`ms-`/`me-`, `start`/`end`) and test any positioned/translated element in RTL.

### Recurring sessions & double-booking

`createSessionAction` supports weekly/biweekly series: it creates a parent (holding an RRULE string in `recurrenceRule`) plus child sessions (`parentSessionId`), each with its own reminders. All create/update/reschedule paths run an overlap check against SCHEDULED sessions (`findOverlaps` in `sessions.ts`); forms expose an `allowOverlap` checkbox to override, calendar drag just blocks with an alert. `deleteFutureSessionsAction` removes this-and-future sessions in a series (hard-delete unless a note exists).

### Schema fields that look used but aren't

`ReminderChannel.SMS`, `Payment.provider`/`providerTxId`, `Invoice.pdfUrl`, `User.logoUrl`, `Client.intakeDate` — schema scaffolding with no code behind them yet.

## Deployment

Railway (primary — see `DEPLOY_RAILWAY.md`): start command runs `prisma migrate deploy` against the committed `prisma/migrations/` (baseline `0_init`; DBs originally created with `db push` need a one-time `migrate resolve --applied 0_init`). Registration in production requires `ALLOWED_EMAILS`. `vercel.json` defines the reminders cron (every 5 min).
