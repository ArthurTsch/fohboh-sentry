import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  outputFileTracingIncludes: {
    "/api/v1/uploads/route": [
      "./node_modules/pdfjs-dist/**/*",
    ],
    "/api/v1/uploads/[uploadId]/extracted-text/route": [
      "./node_modules/pdfjs-dist/**/*",
    ],
  },
};

export default nextConfig;
