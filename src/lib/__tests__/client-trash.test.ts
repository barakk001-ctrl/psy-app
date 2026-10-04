import { describe, expect, it } from "vitest";
import {
  TRASH_DAYS,
  blockersText,
  clientDeletionDecision,
  daysLeftText,
  deletionContentsText,
  isPurgeDue,
  purgeCutoff,
  selectPurgeDue,
  trashDaysLeft,
  type ClientDeletionFacts,
} from "@/lib/client-trash";
import { liveFilterFor, withLiveFilter } from "@/lib/trash-filter";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-04T09:00:00Z");

function facts(extra: Partial<ClientDeletionFacts> = {}): ClientDeletionFacts {
  return {
    status: "INACTIVE",
    sessions: 0,
    notes: 0,
    files: 0,
    invoices: 0,
    paidSessions: 0,
    morningDocs: 0,
    ...extra,
  };
}

describe("clientDeletionDecision", () => {
  it("lets an inactive client with no tax records be deleted", () => {
    expect(clientDeletionDecision(facts({ sessions: 4 }))).toEqual({
      allowed: true,
      clinicalWarning: false,
    });
  });

  it("never deletes an active client", () => {
    expect(clientDeletionDecision(facts({ status: "ACTIVE" }))).toEqual({
      allowed: false,
      blockers: ["active"],
    });
  });

  it("blocks app invoices, payment records and Morning documents (tax records)", () => {
    expect(clientDeletionDecision(facts({ invoices: 1 }))).toMatchObject({ allowed: false, blockers: ["invoices"] });
    expect(clientDeletionDecision(facts({ paidSessions: 2 }))).toMatchObject({ allowed: false, blockers: ["payments"] });
    expect(clientDeletionDecision(facts({ morningDocs: 1 }))).toMatchObject({ allowed: false, blockers: ["morning"] });
    expect(
      clientDeletionDecision(facts({ status: "ACTIVE", invoices: 1, paidSessions: 1 })),
    ).toEqual({ allowed: false, blockers: ["active", "invoices", "payments"] });
  });

  it("warns about the legal duty to keep records when there are summaries or files", () => {
    expect(clientDeletionDecision(facts({ notes: 3 }))).toEqual({ allowed: true, clinicalWarning: true });
    expect(clientDeletionDecision(facts({ files: 1 }))).toEqual({ allowed: true, clinicalWarning: true });
  });
});

describe("texts", () => {
  it("lists what goes with the client", () => {
    expect(deletionContentsText({ sessions: 3, notes: 2, files: 1 })).toBe(
      "יחד עם התיק יימחקו: 3 פגישות, 2 סיכומים וקובץ מצורף אחד.",
    );
    expect(deletionContentsText({ sessions: 3, notes: 3, files: 0 })).toBe(
      "יחד עם התיק יימחקו: 3 פגישות ו-3 סיכומים.",
    );
    expect(deletionContentsText({ sessions: 1, notes: 0, files: 0 })).toBe(
      "יחד עם התיק יימחקו: פגישה אחת.",
    );
    expect(deletionContentsText({ sessions: 0, notes: 0, files: 0 })).toContain("רק פרטי");
  });

  it("names the blockers (not the inactive rule)", () => {
    expect(blockersText(["active", "invoices", "payments"])).toBe(
      "חשבוניות שהופקו באפליקציה ורישומי תשלום בפגישות",
    );
  });

  it("counts the days left", () => {
    const deleted = new Date(now.getTime() - 10 * DAY);
    expect(trashDaysLeft(deleted, now)).toBe(20);
    expect(trashDaysLeft(new Date(now.getTime() - 29.5 * DAY), now)).toBe(1);
    expect(trashDaysLeft(new Date(now.getTime() - 31 * DAY), now)).toBe(0);
    expect(trashDaysLeft(now, now)).toBe(TRASH_DAYS);
    expect(daysLeftText(20)).toBe("עוד 20 ימים");
    expect(daysLeftText(1)).toBe("עוד יום אחד");
    expect(daysLeftText(0)).toBe("היום");
  });
});

describe("purge selection", () => {
  it("purges only clients deleted 30 days ago or more", () => {
    expect(purgeCutoff(now).getTime()).toBe(now.getTime() - 30 * DAY);
    expect(isPurgeDue(null, now)).toBe(false);
    expect(isPurgeDue(new Date(now.getTime() - 29 * DAY), now)).toBe(false);
    expect(isPurgeDue(new Date(now.getTime() - 30 * DAY), now)).toBe(true);
    const list = [
      { id: "live", deletedAt: null },
      { id: "fresh", deletedAt: new Date(now.getTime() - DAY) },
      { id: "old", deletedAt: new Date(now.getTime() - 45 * DAY) },
    ];
    expect(selectPurgeDue(list, now).map((c) => c.id)).toEqual(["old"]);
  });
});

describe("hidden everywhere: withLiveFilter", () => {
  it("adds the not-deleted condition to reads of a client's data", () => {
    expect(withLiveFilter("Client", "findMany", { where: { userId: "u" } })).toEqual({
      where: { userId: "u", AND: [{ deletedAt: null }] },
    });
    expect(withLiveFilter("Session", "count", undefined)).toEqual({
      where: { AND: [{ client: { deletedAt: null } }] },
    });
    expect(withLiveFilter("ReminderJob", "findMany", { where: {} })).toEqual({
      where: { AND: [{ session: { client: { deletedAt: null } } }] },
    });
  });

  it("keeps existing conditions (an existing AND, a client filter, unique keys)", () => {
    const args = {
      where: { id: "s1", client: { status: "ACTIVE" }, AND: { startsAt: { gt: 1 } } },
      select: { id: true },
    };
    expect(withLiveFilter("Session", "findUnique", args)).toEqual({
      where: {
        id: "s1",
        client: { status: "ACTIVE" },
        AND: [{ startsAt: { gt: 1 } }, { client: { deletedAt: null } }],
      },
      select: { id: true },
    });
    const arr = withLiveFilter("Client", "findFirst", { where: { AND: [{ a: 1 }] } });
    expect(arr).toEqual({ where: { AND: [{ a: 1 }, { deletedAt: null }] } });
  });

  it("leaves writes and unrelated models alone", () => {
    const w = { where: { id: "c" }, data: { deletedAt: null } };
    expect(withLiveFilter("Client", "update", w)).toBe(w);
    expect(withLiveFilter("Client", "deleteMany", w)).toBe(w);
    const inv = { where: { userId: "u" } };
    expect(withLiveFilter("Invoice", "findMany", inv)).toBe(inv);
    expect(liveFilterFor("User")).toBeNull();
    expect(liveFilterFor("SessionNote")).toEqual({ client: { deletedAt: null } });
    expect(liveFilterFor("SessionFile")).toEqual({ client: { deletedAt: null } });
  });
});
