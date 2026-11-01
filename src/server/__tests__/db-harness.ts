// Shared by the suites that run against a real Postgres (*.db.test.ts). They
// only run when TEST_DATABASE_URL is set (locally, and in CI through a service
// container) and skip cleanly otherwise. Nothing here ever reads DATABASE_URL.
//
// Local run: start any throwaway Postgres (scripts/test-db/README.md), then
//   TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/psy_test npm run test:db

import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/** The bare test database address, or "" when there is none. */
export const TEST_DATABASE_URL = (process.env.TEST_DATABASE_URL ?? "").trim();

/**
 * These suites wipe what they touch, so they refuse anything that isn't
 * plainly a throwaway: the host must be this machine and the database name
 * must say "test".
 */
export function assertThrowawayDatabase(url: string): void {
  const parsed = new URL(url);
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  const name = parsed.pathname.replace(/^\//, "");
  if (!local || !/test/i.test(name)) {
    throw new Error("TEST_DATABASE_URL must be a local database with 'test' in its name");
  }
}

/** The same database, one Postgres schema per suite so files can run in parallel. */
export function schemaUrl(url: string, schema: string): string {
  const u = new URL(url);
  u.searchParams.set("schema", schema);
  return u.toString();
}

/** A fresh schema with every committed migration applied (so they get tested too). */
export async function resetTestSchema(schema: string): Promise<void> {
  assertThrowawayDatabase(TEST_DATABASE_URL);
  const admin = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  try {
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await admin.$disconnect();
  }
  execFileSync(
    process.execPath,
    [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
    { env: { ...process.env, DATABASE_URL: schemaUrl(TEST_DATABASE_URL, schema) }, stdio: "pipe" },
  );
}

/** Every table emptied — between tests. */
export async function truncateAll(db: {
  $queryRawUnsafe<T>(q: string): Promise<T>;
  $executeRawUnsafe(q: string): Promise<number>;
}): Promise<void> {
  const rows = await db.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'",
  );
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} CASCADE`);
}

/** Builds the FormData a form would post. */
export function form(fields: Record<string, string | File | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.set(k, v);
  return fd;
}
