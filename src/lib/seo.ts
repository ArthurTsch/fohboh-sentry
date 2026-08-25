import type { Metadata } from "next";

export const SITE_NAME = "FohBoh Sentry";
export const SITE_TITLE = "FohBoh Sentry | Restaurant Financial Evidence Certification";
export const SITE_DESCRIPTION =
  "Govern restaurant processor, POS, delivery-platform, agreement, and bank evidence; run deterministic certifications; and produce traceable CAAR reports.";

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelProductionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidate = configured || (vercelProductionHost ? `https://${vercelProductionHost}` : "http://localhost:3000");

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol");
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function isPublicIndexingEnabled() {
  const siteUrl = getSiteUrl();
  const productionDeployment = process.env.VERCEL_ENV === "production" || (
    process.env.NODE_ENV === "production" && Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim())
  );
  return productionDeployment && siteUrl.hostname !== "localhost" && siteUrl.hostname !== "127.0.0.1";
}

export function getPublicMetadata(): Metadata {
  return {
    alternates: { canonical: "/" },
    description: SITE_DESCRIPTION,
    metadataBase: getSiteUrl(),
    openGraph: {
      description: SITE_DESCRIPTION,
      locale: "en_US",
      siteName: SITE_NAME,
      title: SITE_TITLE,
      type: "website",
      url: "/",
    },
    title: SITE_TITLE,
    twitter: {
      card: "summary",
      description: SITE_DESCRIPTION,
      title: SITE_TITLE,
    },
  };
}

export const privateMetadata: Metadata = {
  robots: {
    follow: false,
    index: false,
    googleBot: { follow: false, index: false, noarchive: true, nosnippet: true },
  },
};
