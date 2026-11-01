import { describe, expect, it } from "vitest";
import { UNKNOWN_IP, clientIpFrom, normalizeIp } from "@/lib/client-ip";

const RAILWAY = { RAILWAY_ENVIRONMENT_ID: "x" };
const headers = (h: Record<string, string>) => new Headers(h);

describe("clientIpFrom on Railway", () => {
  it("uses x-real-ip", () => {
    expect(clientIpFrom(headers({ "x-real-ip": "198.51.100.7" }), RAILWAY)).toBe("198.51.100.7");
  });

  it("ignores whatever x-forwarded-for says", () => {
    const h = headers({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(clientIpFrom(h, RAILWAY)).toBe("198.51.100.7");
  });

  it("without x-real-ip, everyone shares one bucket rather than trusting x-forwarded-for", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "1.2.3.4" }), RAILWAY)).toBe(UNKNOWN_IP);
  });

  it("junk in the header gets no bucket of its own", () => {
    expect(clientIpFrom(headers({ "x-real-ip": "<script>" }), RAILWAY)).toBe(UNKNOWN_IP);
  });
});

describe("clientIpFrom elsewhere", () => {
  it("takes the last x-forwarded-for entry, never the first", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.9" }), {})).toBe("10.0.0.9");
  });

  it("doesn't believe x-real-ip", () => {
    expect(clientIpFrom(headers({ "x-real-ip": "6.6.6.6" }), {})).toBe(UNKNOWN_IP);
  });
});

describe("normalizeIp", () => {
  it("accepts IPv4 and refuses impossible ones", () => {
    expect(normalizeIp(" 8.8.8.8 ")).toBe("8.8.8.8");
    expect(normalizeIp("256.1.1.1")).toBeNull();
    expect(normalizeIp("8.8.8")).toBeNull();
  });

  it("refuses non-addresses", () => {
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp(null)).toBeNull();
    expect(normalizeIp("unknown")).toBeNull();
    expect(normalizeIp("1:2:3")).toBeNull();
    expect(normalizeIp("1::2::3")).toBeNull();
  });

  it("IPv6 addresses in one /64 are one visitor, however they are written", () => {
    const a = normalizeIp("2a02:6b8:0:1:aaaa:bbbb:cccc:dddd");
    expect(a).toBe("2a02:6b8:0:1::/64");
    expect(normalizeIp("2A02:06B8:0000:0001:1:2:3:4")).toBe(a);
    expect(normalizeIp("2a02:6b8:0:1::5")).toBe(a);
    expect(normalizeIp("2a02:6b8:0:2::5")).not.toBe(a);
  });

  it("IPv4 inside IPv6 is the IPv4 address", () => {
    expect(normalizeIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });
});
