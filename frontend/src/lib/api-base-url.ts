const DEV_API_BASE_URL = "http://localhost:8000/api/v1"

export const MISSING_PRODUCTION_API_BASE_URL =
  "VITE_API_BASE_URL must be set for production builds. Use the public API origin (for example https://api.example.com/api/v1). Localhost is not allowed."

export const LOCALHOST_PRODUCTION_API_BASE_URL =
  "VITE_API_BASE_URL cannot be a localhost or loopback URL in production."

export type ApiBaseUrlEnv = {
  MODE?: string
  PROD?: boolean
  DEV?: boolean
  VITEST?: boolean | string
  VITE_API_BASE_URL?: string
}

export function isLocalhostApiUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    )
  } catch {
    return true
  }
}

export function normalizeApiBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

export function assertProductionApiBaseUrl(
  value: string | undefined,
): string {
  const configured = normalizeApiBaseUrl(value ?? "")
  if (!configured) {
    throw new Error(MISSING_PRODUCTION_API_BASE_URL)
  }
  if (isLocalhostApiUrl(configured)) {
    throw new Error(LOCALHOST_PRODUCTION_API_BASE_URL)
  }
  return configured
}

export function resolveApiBaseUrl(env: ApiBaseUrlEnv): string {
  const configured = normalizeApiBaseUrl(env.VITE_API_BASE_URL ?? "")
  const isTest =
    env.MODE === "test" || env.VITEST === true || env.VITEST === "true"
  const isProduction =
    !isTest && (env.PROD === true || env.MODE === "production")

  if (!isProduction) {
    return configured || DEV_API_BASE_URL
  }

  return assertProductionApiBaseUrl(configured)
}
