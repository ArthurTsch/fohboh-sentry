import { getManagerSession } from "@/lib/auth/session";
import { SentryApp } from "@/components/sentry/SentryApp";
import type { Metadata } from "next";
import { getPublicMetadata, privateMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getManagerSession();
  return session ? privateMetadata : getPublicMetadata();
}

export default async function Home() {
  const session = await getManagerSession();
  return <SentryApp initialSession={session} />;
}
