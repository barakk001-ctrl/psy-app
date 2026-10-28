import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Two keys, never interchangeable: the public appointment-request link
// (User.inboxToken, shared with clients, rate-limited per IP by the form) and
// the private inbox API (User.inboxApiToken, shortcuts/automations).
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

describe("inbox tokens", () => {
  it("the API accepts only the API token", () => {
    const api = read("src/app/api/inbox/route.ts");
    expect(api).toMatch(/inboxApiToken: token/);
    expect(api).not.toMatch(/inboxToken: token/);
  });

  it("the public request page and form accept only the request-link token", () => {
    for (const f of ["src/app/request/[token]/page.tsx", "src/server/actions/inbox.ts"]) {
      const src = read(f);
      expect(src).toMatch(/inboxToken: token/);
      expect(src).not.toMatch(/inboxApiToken: token/);
    }
  });

  it("the migration keeps existing request links and gives each a separate API token", () => {
    const sql = read("prisma/migrations/20261029100000_inbox_api_token/migration.sql");
    expect(sql).not.toMatch(/UPDATE "User"\s+SET "inboxToken"/);
    expect(sql).toMatch(/SET "inboxApiToken" = replace\(gen_random_uuid\(\)/);
    expect(sql).not.toMatch(/DROP|DELETE/);
  });
});
