import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the Vite server.
// The CLI will eventually stop passing in HOST,
// so we can remove this workaround after the next major release.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT!) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000",
    },
  },
  build: {
    // Performance optimizations for LCP
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === "production",
        drop_debugger: true,
        pure_funcs: ["console.log"],
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        // Aggressive chunk splitting for better caching and loading
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("lucide-react")) {
              return "icons";
            }
            if (id.includes("@shopify/polaris")) {
              return "polaris";
            }
            if (id.includes("@shopify/app-bridge")) {
              return "app-bridge";
            }
            if (id.includes("react")) {
              return "react-vendor";
            }
            return "vendor";
          }
          // Split route chunks for better loading
          if (id.includes("routes/")) {
            const routeName = id.split("routes/")[1]?.split(".")[0];
            return `route-${routeName}`;
          }
        },
        // Enable module preloading for critical resources
        experimentalMinChunkSize: 1000,
      },
    },
    // Optimize for production builds
    sourcemap: process.env.NODE_ENV === "development",
    chunkSizeWarningLimit: 800,
    assetsInlineLimit: 2048, // Inline small assets to reduce HTTP requests
    // Enable modern module format for better performance
    target: "es2020",
    cssCodeSplit: false, // Bundle CSS for faster loading
  },
  plugins: [reactRouter(), tsconfigPaths()],
  optimizeDeps: {
    // Pre-bundle critical dependencies for faster loading
    include: [
      "@shopify/app-bridge-react",
      "@shopify/polaris",
      "react",
      "react-dom",
      "react-router",
      "lucide-react",
    ],
    exclude: [], // Don't exclude anything for better bundling
  },
}) satisfies UserConfig;
