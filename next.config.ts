import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 社内専用：検索エンジンに載せない
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
