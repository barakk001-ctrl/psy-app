import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CASES,
  NO_ID_INPUT,
  NO_ID_ROUTES,
  ROUTE_CASES,
} from "@/server/__tests__/isolation-cases";

// Like write-lock.test.ts, for tenant isolation. Every exported server action
// and every API route must either have an attack case in isolation-cases.ts
// (run on a real Postgres by isolation.db.test.ts) or be listed as taking no
// id, with the reason. A new action or route that does neither fails here,
// with no database needed, so it fails in every `npm test`.

const ACTIONS_DIR = path.join(process.cwd(), "src", "server", "actions");
const API_DIR = path.join(process.cwd(), "src", "app", "api");

function exportedActions(): { key: string; head: string; body: string }[] {
  const out: { key: string; head: string; body: string }[] = [];
  for (const file of fs.readdirSync(ACTIONS_DIR).filter((f) => f.endsWith(".ts"))) {
    const src = fs.readFileSync(path.join(ACTIONS_DIR, file), "utf8");
    const starts = [...src.matchAll(/^export async function (\w+)\s*\(/gm)];
    starts.forEach((m, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].index! : src.length;
      const body = src.slice(m.index!, end);
      const key = `${file.replace(/\.ts$/, "")}.${m[1]}`;
      out.push({ key, head: body.slice(0, body.indexOf("{")), body });
    });
  }
  return out;
}

function apiRoutes(): { key: string }[] {
  const out: { key: string }[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/^route\.tsx?$/.test(e.name)) {
        out.push({ key: path.relative(API_DIR, dir).split(path.sep).join("/") });
      }
    }
  };
  walk(API_DIR);
  return out;
}

/** Reads an id or a token from its input: it can't be declared as taking none. */
const TAKES_ID =
  /formData\.get\("(\w*[iI]d|token)"\)|\b(id|\w+Id)\s*:\s*string\b|input\.(id|\w+Id)\b/;

/** Fields that end in "Id" without naming any record: the account's own settings, a plan's name. */
const NOT_RECORD_IDS = /\b(businessId|morningApiKeyId|planId)\b/g;
const readsId = (text: string) => TAKES_ID.test(text.replace(NOT_RECORD_IDS, ""));

describe("isolation coverage", () => {
  const actions = exportedActions();
  const routes = apiRoutes();

  it("finds the actions and routes", () => {
    expect(actions.length).toBeGreaterThan(60);
    expect(routes.length).toBeGreaterThan(10);
  });

  it("every server action has an attack case or is declared as taking no id", () => {
    const missing = actions
      .map((a) => a.key)
      .filter((k) => !(k in CASES) && !(k in NO_ID_INPUT));
    expect(missing).toEqual([]);
  });

  it("every API route has an attack case or is declared as taking no id", () => {
    const missing = routes
      .map((r) => r.key)
      .filter((k) => !(k in ROUTE_CASES) && !(k in NO_ID_ROUTES));
    expect(missing).toEqual([]);
  });

  it("an action that reads an id can't be declared as taking none", () => {
    const allowedToReadOwnKeys = new Set([
      // These read a token proving something else: a reset link or an email code
      "auth.resetPasswordAction",
      "auth.confirmEmailAction",
    ]);
    const wrong = actions
      .filter((a) => a.key in NO_ID_INPUT && !allowedToReadOwnKeys.has(a.key))
      .filter((a) => readsId(a.head) || readsId(a.body))
      .map((a) => a.key);
    expect(wrong).toEqual([]);
  });

  it("no stale names, no case listed twice", () => {
    const actionKeys = new Set(actions.map((a) => a.key));
    const routeKeys = new Set(routes.map((r) => r.key));
    expect(Object.keys(CASES).filter((k) => !actionKeys.has(k))).toEqual([]);
    expect(Object.keys(NO_ID_INPUT).filter((k) => !actionKeys.has(k))).toEqual([]);
    expect(Object.keys(ROUTE_CASES).filter((k) => !routeKeys.has(k))).toEqual([]);
    expect(Object.keys(NO_ID_ROUTES).filter((k) => !routeKeys.has(k))).toEqual([]);
    expect(Object.keys(CASES).filter((k) => k in NO_ID_INPUT)).toEqual([]);
    expect(Object.keys(ROUTE_CASES).filter((k) => k in NO_ID_ROUTES)).toEqual([]);
  });

  it("the file downloads, PDFs, calendar feed, uploads and morning documents are all attacked", () => {
    for (const k of [
      "files/[id]",
      "documents/[id]",
      "invoices/[id]/pdf",
      "clients/[id]/summaries",
      "support/[id]/attachment",
      "calendar/[token]",
      "inbox",
    ]) {
      expect(ROUTE_CASES).toHaveProperty([k]);
    }
    for (const k of [
      "files.uploadSessionFileAction",
      "client-documents.uploadClientDocumentAction",
      "morning-docs.attachMorningNumberToSessionAction",
      "morning-docs.assignMorningDocumentAction",
      "documents.issueDocumentAction",
      "documents.creditNoteAction",
    ]) {
      expect(CASES).toHaveProperty([k]);
    }
  });
});
