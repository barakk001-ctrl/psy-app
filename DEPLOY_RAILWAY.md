# Deploying to Railway

This project deploys cleanly on Railway. Here's the full process.

> ⚠️ **If you have an existing `package-lock.json` from before the security patches**: delete both `package-lock.json` and `node_modules/` and run `npm install` fresh. Railway scans the lock file too, and a stale lock pinning vulnerable Next.js will fail the deploy even after `package.json` is updated.

## 1. Create the project

1. Push this repo to GitHub (or GitLab).
2. Go to [railway.com](https://railway.com), click **New Project → Deploy from GitHub repo**, select the repo.
3. Railway will detect Next.js and start building. **Stop the first build** — we need to add the database first, otherwise it'll fail without `DATABASE_URL`.

## 2. Add Postgres

1. In your project, click **+ New → Database → Add PostgreSQL**.
2. Railway provisions a Postgres instance and a `DATABASE_URL` env var on the database service.
3. On the **app service**, click **Variables → Add Reference Variable → DATABASE_URL** and pick the Postgres service. This wires the two services together.

## 3. Set environment variables

On the **app service** → **Variables**, add:

```bash
# Auth — generate locally with: openssl rand -base64 32
AUTH_SECRET=<paste your generated secret>
AUTH_TRUST_HOST=true

# Encryption for clinical notes — must be 32 bytes base64
# Generate locally: openssl rand -base64 32
NOTES_ENCRYPTION_KEY=<paste your generated key>

# Email reminders (optional — leave empty to skip emails)
RESEND_API_KEY=re_...
EMAIL_FROM="מרפאה <reminders@yourdomain.com>"

# Cron auth — generate locally: openssl rand -base64 32
CRON_SECRET=<paste your generated secret>
```

> ⚠️ **Back up `NOTES_ENCRYPTION_KEY` somewhere outside Railway.** If you lose it, every clinical note becomes unreadable forever.

## 4. Generate the public URL

On the app service → **Settings → Networking → Generate Domain**. Railway gives you something like `your-app.up.railway.app`. Copy it.

Then add one more variable:

```bash
NEXTAUTH_URL=https://your-app.up.railway.app
```

## 5. Generate the first migration locally, then redeploy

Railway runs `npx prisma migrate deploy` on every deploy (configured in `railway.json`). It only applies migrations that already exist — it doesn't generate them. So generate the first one locally against your Railway DB:

```bash
# Get the Postgres DATABASE_URL from Railway (the public one, with sslmode=require)
# Variables tab on the Postgres service → DATABASE_PUBLIC_URL

DATABASE_URL="postgresql://..." npx prisma migrate dev --name init
```

This creates `prisma/migrations/<timestamp>_init/migration.sql`. Commit and push it. Railway will pick it up and run `migrate deploy` on the next build.

## 6. Set up the cron for reminders

Railway doesn't have Vercel-style cron syntax. Pick one option:

### Option A — Railway cron service (recommended)

In your Railway project, click **+ New → Empty Service**, name it `reminders-cron`. In its **Settings → Deploy**:

- **Cron Schedule**: `*/5 * * * *`
- **Start Command**:
  ```bash
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders
  ```

Add variables to that service:
- `CRON_SECRET` — same value as on the app
- `APP_URL` — your `https://your-app.up.railway.app`

### Option B — External cron (free, no extra Railway service)

Sign up at [cron-job.org](https://cron-job.org) (free), create a job:

- URL: `https://your-app.up.railway.app/api/cron/reminders`
- Schedule: every 5 minutes
- Method: POST
- Header: `Authorization: Bearer <your CRON_SECRET>`

## 7. Verify

Visit `https://your-app.up.railway.app` → register an account → add a client → schedule a session. Then test the cron once manually:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.up.railway.app/api/cron/reminders
# {"ok":true,"considered":0,"sent":0,"failed":0,"skipped":0}
```

## Costs

- **Hobby plan**: $5/month minimum, includes $5 of usage credit. A small practice will easily fit inside this.
- **Postgres**: pay-as-you-go for storage and compute. Tiny for this app.
- The Railway cron service runs only briefly every 5 minutes — negligible cost.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails: `Can't reach database` | Add the `DATABASE_URL` reference variable from the Postgres service to the app service. |
| `AuthError: MissingSecret` | `AUTH_SECRET` not set. |
| Login page returns 500 with `relation "User" does not exist` | Migrations haven't been applied. Run `prisma migrate dev --name init` locally against the Railway DB and push the migration files, or run `prisma db push` once via `railway run` from the CLI. |
| PDF route returns 500 about fonts | Heebo loads from jsDelivr at runtime. Check the Railway service has outbound internet (it does by default — only worry about this if you set up egress restrictions). |
| Reminders never send | Check the cron service is running, that `CRON_SECRET` matches, and that `RESEND_API_KEY` + `EMAIL_FROM` are set on the app service. |
