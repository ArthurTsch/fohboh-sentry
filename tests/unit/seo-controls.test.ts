import { afterEach, describe, expect, it } from "vitest";

import robots from "../../src/app/robots";
import sitemap from "../../src/app/sitemap";
import { getPublicMetadata, getSiteUrl, isPublicIndexingEnabled, privateMetadata } from "../../src/lib/seo";

const originalEnvironment = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("WEB-012 SEO controls", () => {
  it("publishes complete public metadata without authenticated data", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sentry.example.com/private/path";
    const metadata = getPublicMetadata();

    expect(getSiteUrl().toString()).toBe("https://sentry.example.com/");
    expect(metadata).toMatchObject({
      alternates: { canonical: "/" },
      description: expect.stringContaining("restaurant"),
      openGraph: { type: "website", url: "/" },
      twitter: { card: "summary" },
    });
    expect(JSON.stringify(metadata)).not.toMatch(/email|account|manager|session/i);
  });

  it("blocks indexing outside production", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://preview.example.com";
    process.env.VERCEL_ENV = "preview";

    expect(isPublicIndexingEnabled()).toBe(false);
    expect(robots()).toEqual({ rules: [{ userAgent: "*", disallow: "/" }] });
  });

  it("allows only public discovery routes in production", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://sentry.example.com";
    process.env.VERCEL_ENV = "production";

    expect(isPublicIndexingEnabled()).toBe(true);
    expect(robots()).toEqual({
      rules: [{
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/superadmin/"],
      }],
      sitemap: "https://sentry.example.com/sitemap.xml",
    });
    expect(sitemap()).toEqual([{
      changeFrequency: "monthly",
      priority: 1,
      url: "https://sentry.example.com/",
    }]);
  });

  it("marks private HTML surfaces no-index and no-follow", () => {
    expect(privateMetadata).toMatchObject({
      robots: { follow: false, index: false },
    });
  });
});
