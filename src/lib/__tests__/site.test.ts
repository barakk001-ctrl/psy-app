import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { gateRequest } from "@/lib/auth-gate";
import { NO_CRAWL_PATHS, PUBLIC_PAGES, SITE_URL } from "@/lib/site";

describe("the public site", () => {
  it("every page in the sitemap is open to a signed-out visitor", () => {
    for (const p of PUBLIC_PAGES) expect(gateRequest(p, null)).toEqual({ type: "allow" });
  });

  it("the sitemap lists full canonical addresses", () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain(SITE_URL);
    expect(urls).toContain(`${SITE_URL}/pricing`);
    expect(urls.every((u) => u.startsWith(SITE_URL))).toBe(true);
  });

  it("robots keeps crawlers out of private areas and points to the sitemap", () => {
    const r = robots();
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(NO_CRAWL_PATHS).toContain("/request/");
    expect(NO_CRAWL_PATHS).toContain("/clients");
    for (const p of PUBLIC_PAGES) expect(NO_CRAWL_PATHS).not.toContain(p);
  });

  it("the installed app still starts at /dashboard, not the public home", () => {
    expect(manifest().start_url).toBe("/dashboard");
  });
});
