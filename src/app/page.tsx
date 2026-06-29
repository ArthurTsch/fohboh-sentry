import { getManagerSession } from "@/lib/auth/session";
import { SentryApp } from "@/components/sentry/SentryApp";

export default async function Home() {
  const session = await getManagerSession();
  return <SentryApp initialSession={session} />;
}
