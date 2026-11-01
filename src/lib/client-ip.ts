// The visitor's real IP, for rate limits. Pure, tested in client-ip.test.ts.
// Details and how this was measured: CLAUDE.md, "Rate limits and abuse".

type Env = Record<string, string | undefined>;
type HeaderBag = { get(name: string): string | null };

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_GROUP = /^[0-9a-f]{1,4}$/;

/** Everyone whose address can't be read shares this one bucket, which fails safe. */
export const UNKNOWN_IP = "unknown";

function normalizeV4(ip: string): string | null {
  const m = ip.match(IPV4);
  if (!m) return null;
  return m.slice(1).every((n) => Number(n) <= 255) ? m.slice(1).map(Number).join(".") : null;
}

/** The eight groups of an IPv6 address, or null. */
function expandV6(ip: string): string[] | null {
  const pieces = ip.split("::");
  if (pieces.length > 2) return null;
  const groups = (s: string) => (s ? s.split(":") : []);
  const head = groups(pieces[0]);
  const tail = groups(pieces[1] ?? "");
  const missing = 8 - head.length - tail.length;
  if (pieces.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array<string>(Math.max(missing, 0)).fill("0"), ...tail];
  return all.every((g) => IPV6_GROUP.test(g)) ? all : null;
}

/**
 * A real address in one form per visitor, or null: junk in a header must not
 * get a bucket of its own. IPv6 is cut to its /64, because one home or phone
 * can use any address inside that block.
 */
export function normalizeIp(value: string | null | undefined): string | null {
  const ip = value?.trim().toLowerCase();
  if (!ip || ip.length > 45) return null;
  if (!ip.includes(":")) return normalizeV4(ip);

  // IPv4 written inside IPv6 (::ffff:1.2.3.4) is that IPv4 address
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return normalizeV4(mapped[1]);

  const groups = expandV6(ip);
  if (!groups) return null;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/** Railway sets these on every service. */
export function onRailway(env: Env = process.env): boolean {
  return !!(env.RAILWAY_ENVIRONMENT_ID || env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_PROJECT_ID);
}

let warned = false;

export function clientIpFrom(headers: HeaderBag, env: Env = process.env): string {
  if (onRailway(env)) {
    const ip = normalizeIp(headers.get("x-real-ip"));
    if (!ip && !warned) {
      // Railway stopped sending it, and all visitors now share one IP limit
      warned = true;
      console.error("[client-ip] no usable x-real-ip on Railway");
    }
    return ip ?? UNKNOWN_IP;
  }
  // Off Railway nothing writes x-real-ip, so a value there means nothing. The
  // last x-forwarded-for entry is the one added by the nearest proxy.
  const hops = headers.get("x-forwarded-for")?.split(",") ?? [];
  return normalizeIp(hops[hops.length - 1]) ?? UNKNOWN_IP;
}
