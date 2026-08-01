import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 10 MB de PDF (limite do validatePdf) + folga para o overhead do multipart.
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
