import type { MetadataRoute } from "next";
import { getSiteUrl, isPublicIndexingEnabled } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!isPublicIndexingEnabled()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/superadmin/"],
    }],
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}
