import type { MetadataRoute } from "next";
import { NO_CRAWL_PATHS, SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: NO_CRAWL_PATHS },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
