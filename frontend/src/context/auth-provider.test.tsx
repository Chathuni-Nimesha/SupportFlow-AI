import { AxiosError } from "axios"
import type { InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { useAuth } from "@/context/auth-provider"
import { fetchCurrentUser } from "@/services/auth"
import { sampleUser } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

function unauthorizedError() {
  return new AxiosError(
    "Unauthorized",
    AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    {
      status: 401,
      statusText: "Unauthorized",
      data: { detail: "Unauthorized" },
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig,
    },
  )
}

function AuthProbe() {
  const { user, token, isLoading, refreshUser } = useAuth()

  if (isLoading) {
    return <p>Loading session</p>
  }

  return (
    <div>
      <p>token:{token ?? "none"}</p>
      <p>user:{user?.email ?? "none"}</p>
      <button type="button" onClick={() => void refreshUser()}>
        Retry
      </button>
    </div>
  )
}

describe("AuthProvider session restore", () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("restores the current user when the initial request succeeds", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("user:ava@acme.example")).toBeInTheDocument()
    expect(screen.getByText("token:test-token")).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")
    expect(fetchCurrentUser).toHaveBeenCalledTimes(1)
  })

  it("keeps the token after a recoverable non-401 restore failure", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockRejectedValue(
      new Error("Network Error"),
    )

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("user:none")).toBeInTheDocument()
    expect(screen.getByText("token:test-token")).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")
  })

  it("retries fetchCurrentUser and restores the user from Retry", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce(sampleUser)

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("user:none")).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("user:ava@acme.example")).toBeInTheDocument()
    expect(screen.getByText("token:test-token")).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledTimes(2)
    })
  })

  it("clears the session when restore fails with 401", async () => {
    localStorage.setItem("access_token", "expired-token")
    vi.mocked(fetchCurrentUser).mockRejectedValue(unauthorizedError())

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("user:none")).toBeInTheDocument()
    expect(screen.getByText("token:none")).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBeNull()
    expect(fetchCurrentUser).toHaveBeenCalledTimes(1)
  })

  it("does not retry /auth/me after a 401 has cleared the session", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "expired-token")
    vi.mocked(fetchCurrentUser).mockRejectedValue(unauthorizedError())

    renderWithProviders(<AuthProbe />)
    await screen.findByText("token:none")

    await user.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledTimes(1)
    })
    expect(localStorage.getItem("access_token")).toBeNull()
    expect(screen.getByText("user:none")).toBeInTheDocument()
  })
})
