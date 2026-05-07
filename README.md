# מרפאה — Psychology Practice Management

A Next.js 15 app for managing a private psychology practice: clients, sessions, encrypted clinical notes, invoices, payments, and reports. Hebrew/RTL first.

## What's working

- ✅ Hebrew/RTL throughout, with Frank Ruhl Libre + Assistant fonts
- ✅ Auth.js v5 with email/password (credentials) + protected routes
- ✅ Prisma schema covering all v1 entities
- ✅ Application-layer encryption for clinical notes (AES-256-GCM)
- ✅ Dashboard with live stats (active clients, monthly income, outstanding debt, upcoming sessions)
- ✅ Clients: list (with archived toggle), create, edit, archive/unarchive, view detail
- ✅ Calendar (FullCalendar) — week/day/month views, click-to-create, drag-to-reschedule, Hebrew locale, RTL
- ✅ Sessions: create with location/duration/rate, status workflow (scheduled → completed / cancelled / no-show)
- ✅ Encrypted session notes — written by client, encrypted in server action, decrypted only when displayed to authenticated owner
- ✅ Invoices: list, create from completed sessions + custom line items, sequential numbering (transactional), draft/sent/cancelled workflow
- ✅ PDF receipts — `@react-pdf/renderer` with Heebo Hebrew font, RTL layout, served from `/api/invoices/[id]/pdf`
- ✅ Payments — record cash, Bit, transfer, check, card, PayPal; auto-flips invoice to PARTIALLY_PAID / PAID
- ✅ Settings page — edit business info that appears on invoices
- ✅ Email reminders — automatically scheduled 24h + 1h before each session, sent via Resend, processed by a Vercel Cron at `/api/cron/reminders` every 5 minutes
- ✅ Reports — period selector (this/last month, this quarter, this/last year), 4 stat cards, 12-month income chart, breakdown by payment method, top clients, outstanding invoices list

**v1 is complete.** Everything in the original brief works end-to-end.

## Deploying

- **Railway** (recommended — Postgres + app on one platform): see **[DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)** for the full step-by-step.
- **Vercel + Supabase**: deploys cleanly. The `vercel.json` cron config is already in the repo; add a Supabase Postgres URL as `DATABASE_URL` and the rest of the env vars from `.env.example`.
- **Self-hosted**: any Node.js 20+ host with a Postgres connection works. Run `npm run build` then `npm run start`. Wire up your own scheduler to call `/api/cron/reminders` every 5 min with the `Authorization: Bearer $CRON_SECRET` header.

## Getting started

### 1. Install

```bash
npm install
```

### 2. Set up the database

You need a PostgreSQL database. Easiest option: free tier on **Supabase** or **Neon**, or run locally:

```bash
docker run --name psy-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
# DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres
```

### 3. Configure environment

```bash
cp .env.example .env
```

Then fill in `.env`:

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate NOTES_ENCRYPTION_KEY (must be 32 bytes / base64)
openssl rand -base64 32
```

> ⚠️ Back up `NOTES_ENCRYPTION_KEY` somewhere safe. If you lose it, all clinical notes become unreadable. Rotate via re-encryption when you grow.

### 4. Push the schema and run

```bash
npm run db:push    # creates tables in your DB
npm run dev
```

Open http://localhost:3000 → you'll be redirected to `/login`. Click "הרשמה" to create your first account.

### 5. (Optional) Set up email reminders

The app schedules email reminders 24h and 1h before each session. To actually send them:

1. Sign up at [resend.com](https://resend.com) and get an API key
2. Verify a sending domain (or use `onboarding@resend.dev` for testing)
3. Set in `.env`:
   ```bash
   RESEND_API_KEY=re_...
   EMAIL_FROM="מרפאה <reminders@yourdomain.com>"
   CRON_SECRET=$(openssl rand -base64 32)
   ```
4. The cron runs automatically once deployed to Vercel (see `vercel.json`).

To test locally, hit the endpoint manually:
```bash
curl -X POST http://localhost:3000/api/cron/reminders
# returns: {"ok":true,"considered":N,"sent":S,"failed":F,"skipped":K}
```

If `RESEND_API_KEY` is not set, reminder jobs are still scheduled but get marked `FAILED` when the cron runs. The rest of the app works fine without it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (also runs `prisma generate`) |
| `npm run db:push` | Sync schema to DB without migrations (dev only) |
| `npm run db:migrate` | Create + apply a migration |
| `npm run db:studio` | Visual DB browser |

## Project structure

```
prisma/schema.prisma        — full data model
src/
  auth.ts                   — Auth.js v5 config (Node runtime)
  auth.config.ts            — Edge-safe config used by middleware
  middleware.ts             — Route protection
  app/
    (auth)/                 — login, register (split-screen layout)
    (app)/                  — protected app (sidebar layout)
      dashboard/
      clients/, clients/new, clients/[id]
      calendar/, invoices/, reports/, settings/   — stubs
    api/auth/[...nextauth]/ — Auth.js handler
  components/
    ui/                     — Button, Input, Card, Textarea, Label, ComingSoon
    auth/                   — login + register forms
    clients/                — client form
    dashboard/              — stat card
    nav/                    — sidebar
  lib/
    db.ts                   — Prisma singleton
    crypto.ts               — AES-256-GCM helpers for notes
    format.ts               — he-IL date/currency formatters
    utils.ts                — cn() helper
  server/
    actions/                — server actions (auth, clients)
    validators/             — Zod schemas
```

## Design system

| Token | Value | Use |
|---|---|---|
| `cream-100` | `#FAF7F1` | Page background |
| `ink` | `#1A1714` | Body text |
| `sage-600` | `#4A6048` | Primary buttons & active state |
| `terracotta-500` | `#B5654A` | Errors & destructive actions |
| `font-display` | Frank Ruhl Libre | Headings (Hebrew serif) |
| `font-sans` | Assistant | Body (Hebrew sans) |

Use `cn()` from `@/lib/utils` for conditional classes. Use `formatCurrency`, `formatDate`, `formatDateTime` from `@/lib/format` for all user-facing dates and money — they're locked to `he-IL` and `Asia/Jerusalem`.

## Security notes

- **Sessions:** JWT strategy, httpOnly cookies via Auth.js.
- **Passwords:** bcryptjs at cost 10.
- **Clinical notes:** never stored in plaintext. Use `encryptNote()` / `decryptNote()` from `@/lib/crypto`. The DB only ever sees ciphertext + IV + auth tag.
- **Authorization:** every server action calls `auth()` and scopes queries by `userId`. When you add new actions, do the same.
- **Invoice numbers:** sequential per user, never deletable. Use `User.nextInvoiceNumber` inside a transaction when allocating.

## Roadmap

### v1 (complete)
1. ✅ Auth + dashboard + clients CRUD (create, edit, archive/unarchive)
2. ✅ Calendar with FullCalendar (click-to-create, drag-to-reschedule)
3. ✅ Session notes (encrypted at rest)
4. ✅ Session status workflow
5. ✅ Invoice creation with sequential numbering
6. ✅ PDF receipts (Hebrew, RTL)
7. ✅ Manual payments (cash, Bit, transfer, check, card, PayPal)
8. ✅ Settings page for business info
9. ✅ Email reminders (24h + 1h before)
10. ✅ Reports (income, payment methods, top clients, outstanding)

### Possible v2
- ⬜ **Online card payments** — Tranzila, Cardcom, or PayPlus iframe + webhook
- ⬜ **Recurring sessions** — RRULE on `Session.recurrenceRule` already exists in schema
- ⬜ **SMS reminders** — Twilio or Israeli gateway (019 / Inforu)
- ⬜ **CSV export** — for accounting handoff
- ⬜ **Israeli tax-compliant invoices** — integrate with Green Invoice / EZCount / Morning APIs

## Things to know

- **Vercel Cron note:** the schedule in `vercel.json` is `*/5 * * * *` (every 5 minutes). Vercel's free Hobby plan only allows **daily** crons; for finer granularity you need Pro. As a free alternative, point [cron-job.org](https://cron-job.org) at `https://your-domain.com/api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` header.
- **Bit** doesn't expose a public API for receiving payments. Keep it as a manual `Payment` entry.
- **Israeli tax authority integration** (חשבונית מס דיגיטלית) is intentionally out of scope here. If you add it later, you'll need to integrate with an existing provider's API (e.g., Green Invoice / חשבונית ירוקה, EZCount, Morning) rather than building it from scratch.
- The clinical-notes retention period under Ministry of Health guidance is typically **7 years**. Build a retention/anonymization job before you're 7 years in.
