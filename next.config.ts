import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      "vscode-emmet-helper-bundled": "./lib/playground/stubs/emmet-helper.ts",
    },
  },
  // OpenNext copies Next's traced node_modules; tracing runs under Node and
  // only picks the node variants of these packages, while the Workers bundle
  // resolves the "workerd" condition to web.mjs. Force-include the web files.
  outputFileTracingIncludes: {
    "**": [
      "./node_modules/@libsql/isomorphic-ws/**",
      "./node_modules/@libsql/isomorphic-fetch/**",
    ],
  },
  async headers() {
    return [
      {
        source: "/playground/modules/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, HEAD, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
