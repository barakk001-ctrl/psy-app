import { describe, expect, it } from "vitest";
import { clinicDateRange, clinicMonthRange, lastMonths } from "@/lib/income";
import {
  CUSTOM_PERIOD,
  CUSTOM_PERIOD_LABEL,
  PERIOD_KEYS,
  customPeriodHref,
  getPeriodRange,
  isWholeMonth,
  parsePeriodParam,
  periodDates,
  periodHref,
  periodLabel,
  periodOptionLabel,
  reportPeriods,
} from "@/lib/report-periods";

// The clinic is in Israel: UTC+2 in winter, UTC+3 from 27 Mar to 25 Oct 2026
const NOV_16 = new Date("2026-11-16T10:00:00Z");
const utc = (range: [Date, Date]) => range.map((d) => d.toISOString());

describe("the reports period picker", () => {
  it("lists the periods in the picker's order, each with what it covers today", () => {
    expect(reportPeriods(NOV_16).map((p) => p.label)).toEqual([
      "7 ימים אחרונים",
      "12 חודשים אחרונים",
      "חודש נוכחי (נובמבר 2026)",
      "חודש קודם (אוקטובר 2026)",
      "שנה נוכחית (2026)",
      "שנה קודמת (2025)",
      "רבעון 1 (2026)",
      "רבעון 2 (2026)",
      "רבעון 3 (2026)",
      "רבעון 4 (2026)",
    ]);
    expect(reportPeriods(NOV_16).map((p) => p.key)).toEqual([...PERIOD_KEYS]);
  });

  it("names what each period covers in the page's headings", () => {
    expect(periodLabel("last-7-days", NOV_16)).toBe("10.11.2026 עד 16.11.2026");
    expect(periodLabel("last-12-months", NOV_16)).toBe("דצמבר 2025 עד נובמבר 2026");
    expect(periodLabel("this-month", NOV_16)).toBe("נובמבר 2026");
    expect(periodLabel("last-month", NOV_16)).toBe("אוקטובר 2026");
    expect(periodLabel("this-year", NOV_16)).toBe("2026");
    expect(periodLabel("last-year", NOV_16)).toBe("2025");
    expect(periodLabel("q1", NOV_16)).toBe("רבעון 1 2026 (ינואר עד מרץ)");
    expect(periodLabel("q4", NOV_16)).toBe("רבעון 4 2026 (אוקטובר עד דצמבר)");
  });

  it("gives every period a range that is exactly its dates, by the clinic's calendar", () => {
    for (const now of [NOV_16, new Date("2026-12-31T22:00:00Z"), new Date("2028-02-29T08:00:00Z")]) {
      for (const p of reportPeriods(now)) {
        expect(utc(p.range), p.key).toEqual(utc(clinicDateRange(p.from, p.to)));
        expect(p.from <= p.to, p.key).toBe(true);
        if (p.key !== CUSTOM_PERIOD) {
          expect(utc(getPeriodRange(p.key, now)), p.key).toEqual(utc(p.range));
          expect(periodDates(p.key, now), p.key).toEqual({ from: p.from, to: p.to });
        }
      }
    }
  });
});

describe("the year in brackets follows the calendar in Israel", () => {
  // 23:59:59 on 31 Dec 2026 and 00:00:00 on 1 Jan 2027, Israel time. The
  // server's own (UTC) clock still says 2026 at both.
  const before = new Date("2026-12-31T21:59:59Z");
  const after = new Date("2026-12-31T22:00:00Z");

  it("still says 2026 a second before midnight", () => {
    expect(periodOptionLabel("this-year", before)).toBe("שנה נוכחית (2026)");
    expect(periodOptionLabel("last-year", before)).toBe("שנה קודמת (2025)");
    expect(periodOptionLabel("this-month", before)).toBe("חודש נוכחי (דצמבר 2026)");
    expect(periodOptionLabel("last-month", before)).toBe("חודש קודם (נובמבר 2026)");
    expect(periodOptionLabel("q4", before)).toBe("רבעון 4 (2026)");
    expect(periodDates("this-year", before)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("moves to 2027 at midnight, labels and ranges together", () => {
    expect(after.getUTCFullYear()).toBe(2026);
    expect(periodOptionLabel("this-year", after)).toBe("שנה נוכחית (2027)");
    expect(periodOptionLabel("last-year", after)).toBe("שנה קודמת (2026)");
    expect(periodOptionLabel("this-month", after)).toBe("חודש נוכחי (ינואר 2027)");
    expect(periodOptionLabel("last-month", after)).toBe("חודש קודם (דצמבר 2026)");
    expect(PERIOD_KEYS.filter((k) => k.startsWith("q")).map((k) => periodOptionLabel(k, after))).toEqual([
      "רבעון 1 (2027)",
      "רבעון 2 (2027)",
      "רבעון 3 (2027)",
      "רבעון 4 (2027)",
    ]);
    expect(utc(getPeriodRange("this-year", after))).toEqual([
      "2026-12-31T22:00:00.000Z",
      "2027-12-31T22:00:00.000Z",
    ]);
    // Last year is now exactly what "this year" was a second ago
    expect(utc(getPeriodRange("last-year", after))).toEqual(utc(getPeriodRange("this-year", before)));
    expect(utc(getPeriodRange("last-year", after))).toEqual([
      "2025-12-31T22:00:00.000Z",
      "2026-12-31T22:00:00.000Z",
    ]);
  });

  it("keeps the moment itself inside the year its label names", () => {
    for (const now of [before, after]) {
      const [from, to] = getPeriodRange("this-year", now);
      expect(from <= now && now < to).toBe(true);
      const [mFrom, mTo] = getPeriodRange("this-month", now);
      expect(mFrom <= now && now < mTo).toBe(true);
    }
  });

  it("takes last month and the 12 months back across the year in January", () => {
    const jan = new Date("2027-01-10T09:00:00Z");
    expect(periodDates("last-month", jan)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(periodDates("last-12-months", jan)).toEqual({ from: "2026-02-01", to: "2027-01-31" });
    expect(periodLabel("last-12-months", jan)).toBe("פברואר 2026 עד ינואר 2027");
  });
});

describe("the four quarters of the current year", () => {
  const may = new Date("2026-05-10T09:00:00Z");

  it("cuts them at the calendar's quarter days", () => {
    expect(periodDates("q1", may)).toEqual({ from: "2026-01-01", to: "2026-03-31" });
    expect(periodDates("q2", may)).toEqual({ from: "2026-04-01", to: "2026-06-30" });
    expect(periodDates("q3", may)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(periodDates("q4", may)).toEqual({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("starts and ends each at midnight in Israel, summer time included", () => {
    expect(utc(getPeriodRange("q1", may))).toEqual(["2025-12-31T22:00:00.000Z", "2026-03-31T21:00:00.000Z"]);
    expect(utc(getPeriodRange("q2", may))).toEqual(["2026-03-31T21:00:00.000Z", "2026-06-30T21:00:00.000Z"]);
    expect(utc(getPeriodRange("q3", may))).toEqual(["2026-06-30T21:00:00.000Z", "2026-09-30T21:00:00.000Z"]);
    expect(utc(getPeriodRange("q4", may))).toEqual(["2026-09-30T21:00:00.000Z", "2026-12-31T22:00:00.000Z"]);
  });

  it("leaves no gap and no overlap, and together they are the year", () => {
    const [q1, q2, q3, q4] = (["q1", "q2", "q3", "q4"] as const).map((k) => getPeriodRange(k, may));
    expect(q1[1]).toEqual(q2[0]);
    expect(q2[1]).toEqual(q3[0]);
    expect(q3[1]).toEqual(q4[0]);
    const year = getPeriodRange("this-year", may);
    expect(q1[0]).toEqual(year[0]);
    expect(q4[1]).toEqual(year[1]);
  });

  it("puts a meeting late on 31 March in quarter 1 and one at midnight in quarter 2", () => {
    const inRange = (d: string, [a, b]: [Date, Date]) => new Date(d) >= a && new Date(d) < b;
    const lateMarch = "2026-03-31T20:30:00Z"; // 23:30 in Israel
    const firstOfApril = "2026-03-31T21:00:00Z"; // 00:00 on 1 April
    expect(inRange(lateMarch, getPeriodRange("q1", may))).toBe(true);
    expect(inRange(lateMarch, getPeriodRange("q2", may))).toBe(false);
    expect(inRange(firstOfApril, getPeriodRange("q1", may))).toBe(false);
    expect(inRange(firstOfApril, getPeriodRange("q2", may))).toBe(true);
  });

  it("marks a quarter that hasn't begun, and only that", () => {
    const byKey = Object.fromEntries(reportPeriods(may).map((p) => [p.key, p.notStarted]));
    expect(byKey).toMatchObject({ q1: false, q2: false, q3: true, q4: true });
    expect(byKey["this-year"]).toBe(false);
    expect(byKey["last-7-days"]).toBe(false);
    // Quarter 4 while it runs: under way, not "not started"
    expect(reportPeriods(NOV_16).find((p) => p.key === "q4")?.notStarted).toBe(false);
    // On its first instant a quarter has started
    const start = getPeriodRange("q3", may)[0];
    expect(reportPeriods(start).find((p) => p.key === "q3")?.notStarted).toBe(false);
  });

  it("belongs to the new year once it starts", () => {
    expect(periodDates("q4", new Date("2026-12-31T22:00:00Z"))).toEqual({ from: "2027-10-01", to: "2027-12-31" });
  });
});

describe("the last 7 days and the last 12 months", () => {
  it("counts today and the six days before it", () => {
    expect(periodDates("last-7-days", NOV_16)).toEqual({ from: "2026-11-10", to: "2026-11-16" });
    expect(utc(getPeriodRange("last-7-days", NOV_16))).toEqual([
      "2026-11-09T22:00:00.000Z",
      "2026-11-16T22:00:00.000Z",
    ]);
  });

  it("goes by today's date in Israel, not the server's", () => {
    // 00:30 on 16 November in Israel, still the 15th in UTC
    expect(periodDates("last-7-days", new Date("2026-11-15T22:30:00Z")).to).toBe("2026-11-16");
    expect(periodDates("last-7-days", new Date("2026-11-15T21:30:00Z")).to).toBe("2026-11-15");
  });

  it("crosses a month, a year and the clock change", () => {
    expect(periodDates("last-7-days", new Date("2027-01-03T10:00:00Z"))).toEqual({
      from: "2026-12-28",
      to: "2027-01-03",
    });
    // Summer time ends on 25 October 2026: the first day starts at UTC+3
    expect(utc(getPeriodRange("last-7-days", new Date("2026-10-27T10:00:00Z")))).toEqual([
      "2026-10-20T21:00:00.000Z",
      "2026-10-27T22:00:00.000Z",
    ]);
  });

  it("covers the same 12 months as the charts on the page", () => {
    expect(periodDates("last-12-months", NOV_16)).toEqual({ from: "2025-12-01", to: "2026-11-30" });
    const months = lastMonths(12, NOV_16);
    expect(utc(getPeriodRange("last-12-months", NOV_16))).toEqual([
      clinicMonthRange(months[0].year, months[0].month)[0].toISOString(),
      clinicMonthRange(months[11].year, months[11].month)[1].toISOString(),
    ]);
  });

  it("ends February on the 29th in a leap year", () => {
    expect(periodDates("this-month", new Date("2028-02-10T09:00:00Z"))).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });
});

describe("the address of a period", () => {
  it("reads ?period= and turns the old single quarter tab into today's quarter", () => {
    expect(parsePeriodParam("q3", NOV_16)).toBe("q3");
    expect(parsePeriodParam("last-12-months", NOV_16)).toBe("last-12-months");
    expect(parsePeriodParam("this-quarter", NOV_16)).toBe("q4");
    expect(parsePeriodParam("this-quarter", new Date("2026-12-31T22:00:00Z"))).toBe("q1");
    expect(parsePeriodParam("this-quarter", new Date("2026-03-31T20:59:00Z"))).toBe("q1");
    expect(parsePeriodParam("this-quarter", new Date("2026-03-31T21:00:00Z"))).toBe("q2");
    expect(parsePeriodParam(CUSTOM_PERIOD, NOV_16)).toBeNull();
    expect(parsePeriodParam("next-year", NOV_16)).toBeNull();
    expect(parsePeriodParam(undefined, NOV_16)).toBeNull();
  });

  it("keeps the default period's address bare", () => {
    expect(periodHref("this-month")).toBe("/reports");
    expect(periodHref("q2")).toBe("/reports?period=q2");
    expect(customPeriodHref("2026-03-01", "2026-04-15")).toBe("/reports?from=2026-03-01&to=2026-04-15");
  });
});

describe("a range of her own dates", () => {
  it("comes last, with its dates as the heading", () => {
    const list = reportPeriods(NOV_16, { from: "2026-03-01", to: "2026-04-15" });
    expect(list).toHaveLength(PERIOD_KEYS.length + 1);
    const custom = list[list.length - 1];
    expect(custom).toMatchObject({
      key: CUSTOM_PERIOD,
      label: CUSTOM_PERIOD_LABEL,
      heading: "1.3.2026 עד 15.4.2026",
      from: "2026-03-01",
      to: "2026-04-15",
      notStarted: false,
    });
    // 15 April whole: up to midnight that ends it, in summer time
    expect(utc(custom.range)).toEqual(["2026-02-28T22:00:00.000Z", "2026-04-15T21:00:00.000Z"]);
  });

  it("reads as the month when it is exactly one", () => {
    expect(reportPeriods(NOV_16, { from: "2026-03-01", to: "2026-03-31" }).at(-1)?.heading).toBe("מרץ 2026");
  });

  it("is absent unless asked for", () => {
    expect(reportPeriods(NOV_16).some((p) => p.key === CUSTOM_PERIOD)).toBe(false);
    expect(reportPeriods(NOV_16, null).some((p) => p.key === CUSTOM_PERIOD)).toBe(false);
  });

  it("knows a whole month from anything else", () => {
    expect(isWholeMonth("2026-11-01", "2026-11-30")).toBe(true);
    expect(isWholeMonth("2028-02-01", "2028-02-29")).toBe(true);
    expect(isWholeMonth("2026-11-01", "2026-11-29")).toBe(false);
    expect(isWholeMonth("2026-11-02", "2026-11-30")).toBe(false);
    expect(isWholeMonth("2026-10-01", "2026-11-30")).toBe(false);
    expect(isWholeMonth("2026-01-01", "2026-12-31")).toBe(false);
  });
});
