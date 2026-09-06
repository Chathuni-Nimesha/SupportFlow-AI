import { describe, expect, it } from "vitest"

import {
  LOCALHOST_PRODUCTION_API_BASE_URL,
  MISSING_PRODUCTION_API_BASE_URL,
  assertProductionApiBaseUrl,
  isLocalhostApiUrl,
  resolveApiBaseUrl,
} from "@/lib/api-base-url"

describe("api base URL", () => {
  it("uses the local API in development when unset", () => {
    expect(resolveApiBaseUrl({ MODE: "development", PROD: false })).toBe(
      "http://localhost:8000/api/v1",
    )
  })

  it("uses the local API in Vitest when unset", () => {
    expect(
      resolveApiBaseUrl({ MODE: "test", PROD: false, VITEST: true }),
    ).toBe("http://localhost:8000/api/v1")
  })

  it("allows an explicit development URL", () => {
    expect(
      resolveApiBaseUrl({
        MODE: "development",
        PROD: false,
        VITE_API_BASE_URL: "http://localhost:8000/api/v1/",
      }),
    ).toBe("http://localhost:8000/api/v1")
  })

  it("fails production builds when the API URL is missing", () => {
    expect(() =>
      resolveApiBaseUrl({ MODE: "production", PROD: true }),
    ).toThrow(MISSING_PRODUCTION_API_BASE_URL)
    expect(() => assertProductionApiBaseUrl(undefined)).toThrow(
      MISSING_PRODUCTION_API_BASE_URL,
    )
  })

  it("fails production builds that point at localhost", () => {
    expect(() =>
      resolveApiBaseUrl({
        MODE: "production",
        PROD: true,
        VITE_API_BASE_URL: "http://localhost:8000/api/v1",
      }),
    ).toThrow(LOCALHOST_PRODUCTION_API_BASE_URL)
    expect(isLocalhostApiUrl("http://127.0.0.1:8000/api/v1")).toBe(true)
  })

  it("accepts a public HTTPS API origin in production", () => {
    expect(
      resolveApiBaseUrl({
        MODE: "production",
        PROD: true,
        VITE_API_BASE_URL: "https://api.example.com/api/v1/",
      }),
    ).toBe("https://api.example.com/api/v1")
  })
})
