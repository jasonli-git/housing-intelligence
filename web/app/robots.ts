import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Open to every crawler, and points at the sitemap (#358). Cloudflare's managed robots
 * rules, which state the site's content signals, are added in front of this file at the
 * edge; nothing here contradicts them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
