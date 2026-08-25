import type { Metadata } from "next";
import { privateMetadata } from "@/lib/seo";

export const metadata: Metadata = privateMetadata;

export default function SuperAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
