import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

import { assertProductionApiBaseUrl } from "./src/lib/api-base-url"

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "build" && mode === "production") {
    const env = loadEnv(mode, __dirname, "")
    assertProductionApiBaseUrl(env.VITE_API_BASE_URL)
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      open: true,
    },
    test: {
      environment: "happy-dom",
      setupFiles: "./src/test/setup.ts",
      include: ["src/**/*.test.{ts,tsx}"],
      restoreMocks: true,
      clearMocks: true,
      pool: "forks",
    },
  }
})
