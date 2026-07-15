import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/v1/uploads/route": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
    "/api/v1/uploads/[uploadId]/extracted-text/route": [
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
  },
};

export default nextConfig;
