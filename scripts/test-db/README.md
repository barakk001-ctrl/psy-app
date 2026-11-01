# Suites that need a real Postgres

`src/server/__tests__/*.db.test.ts` run against a throwaway database with made-up
practices. `npm test` skips them unless `TEST_DATABASE_URL` is set. CI sets it
(a Postgres service container in `.github/workflows/ci.yml`), so they run on
every push.

They refuse any address that isn't on this machine or whose database name lacks
`test`, they never read `DATABASE_URL`, and they create and drop their own
Postgres schemas, so all they need is an empty database.

## Running them locally

With any local Postgres:

```bash
TEST_DATABASE_URL="postgresql://USER:PASSWORD@127.0.0.1:5432/psy_test" npm run test:db
```

Without one, `pg-start.mjs` here starts a private copy. Run it from a scratch
folder outside the repo, so nothing is added to the app's dependencies:

```bash
mkdir ../psy-test-pg && cd ../psy-test-pg
npm init -y && npm i embedded-postgres
node ../psy-app/scripts/test-db/pg-start.mjs   # leave it running
```

Then, in the repo:

```bash
TEST_DATABASE_URL="postgresql://psy:localtestonly@127.0.0.1:54330/psy_test" npm run test:db
```

The coverage check (`isolation-coverage.test.ts`) needs no database and always
runs in `npm test`: a new server action or API route fails it until it has a
case in `isolation-cases.ts` or is declared as taking no id.
