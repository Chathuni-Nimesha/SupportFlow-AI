import type { InternalAxiosRequestConfig } from "axios"
import { describe, expect, it } from "vitest"

import { api } from "@/services/api"

type RequestHandlers = {
  handlers: Array<{
    fulfilled?: (
      config: InternalAxiosRequestConfig,
    ) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>
  }>
}

describe("api client workspace boundary", () => {
  it("attaches the access token and does not send a client workspace header", async () => {
    localStorage.setItem("access_token", "test-token")
    const interceptor = api.interceptors.request as unknown as RequestHandlers
    const handler = interceptor.handlers[0]?.fulfilled
    expect(handler).toBeTypeOf("function")

    const config = await handler!({
      headers: {},
    } as InternalAxiosRequestConfig)

    expect(config.headers.Authorization).toBe("Bearer test-token")
    expect(config.headers["X-Workspace-Id"]).toBeUndefined()
    expect(config.headers["x-workspace-id"]).toBeUndefined()
  })
})
