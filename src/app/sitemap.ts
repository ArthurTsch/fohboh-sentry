import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    changeFrequency: "monthly",
    priority: 1,
    url: getSiteUrl().toString(),
  }];
}
