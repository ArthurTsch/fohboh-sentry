import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingIncludes: {
    "/superadmin/engine": ["./docs/rule-registry-198.json"],
    "/api/v1/uploads": ["./docs/rule-registry-198.json"],
    "/api/v1/uploads/[uploadId]/extracted-text": ["./docs/rule-registry-198.json"],
  },
};

export default nextConfig;
