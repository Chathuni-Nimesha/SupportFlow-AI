import { AxiosError } from "axios"
import type { InternalAxiosRequestConfig } from "axios"
import { describe, expect, it } from "vitest"

import { getApiErrorMessage } from "@/utils/api-error"

function axiosDetail(detail: unknown, status = 422) {
  return new AxiosError(
    "Request failed",
    AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    {
      status,
      statusText: "Unprocessable Entity",
      data: { detail },
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig,
    },
  )
}

describe("getApiErrorMessage", () => {
  it("returns string API details", () => {
    expect(
      getApiErrorMessage(axiosDetail("Customer not found.", 404)),
    ).toBe("Customer not found.")
  })

  it("unwraps pydantic value errors for status and priority", () => {
    expect(
      getApiErrorMessage(
        axiosDetail([
          {
            loc: ["body", "status"],
            msg: "Value error, Invalid status. Must be one of: OPEN, IN_PROGRESS, PENDING, RESOLVED, CLOSED.",
          },
        ]),
      ),
    ).toBe(
      "Invalid status. Must be one of: OPEN, IN_PROGRESS, PENDING, RESOLVED, CLOSED.",
    )
  })
})
