import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/", ".next/", "e2e/"],
    coverage: {
      provider: "istanbul",
      reporter: ["html", "text", "json"],
      reportsDirectory: "./coverage",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@upstash/redis": path.resolve(__dirname, "__mocks__/upstash-redis.ts"),
    },
  },
} as any);
