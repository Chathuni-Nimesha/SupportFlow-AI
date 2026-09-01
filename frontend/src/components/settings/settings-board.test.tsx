import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import { SettingsBoard } from "@/components/settings/settings-board"
import { fetchCurrentUser } from "@/services/auth"
import { sampleUser } from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

describe("SettingsBoard", () => {
  it("shows a loading state", async () => {
    localStorage.setItem("access_token", "test-token")
    const pending = deferred<typeof sampleUser>()
    vi.mocked(fetchCurrentUser).mockReturnValue(pending.promise)

    renderWithProviders(<SettingsBoard />)

    expect(await screen.findByText("Loading your account…")).toBeInTheDocument()
    pending.resolve(sampleUser)
    expect(await screen.findByText("ava@acme.example")).toBeInTheDocument()
  })

  it("renders account details, appearance, and unavailable settings", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)

    renderWithProviders(<SettingsBoard />)

    expect(await screen.findByText("ava@acme.example")).toBeInTheDocument()
    expect(screen.getByText("Ava")).toBeInTheDocument()
    expect(screen.getByText("Chen")).toBeInTheDocument()
    expect(screen.getByText("Acme Support")).toBeInTheDocument()
    expect(screen.getByText("Appearance")).toBeInTheDocument()
    expect(screen.getByText(/Current mode: Light/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Profile editing")).toBeInTheDocument()
    expect(screen.getByText("Password change")).toBeInTheDocument()
    expect(screen.getByText("API keys")).toBeInTheDocument()
    expect(screen.getAllByText("Not available").length).toBeGreaterThanOrEqual(5)
  })

  it("toggles appearance through the existing theme control", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)

    renderWithProviders(<SettingsBoard />)
    await screen.findByText("Appearance")

    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }))

    expect(screen.getByText(/Current mode: Dark/)).toBeInTheDocument()
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })

  it("retries the current-user request after a recoverable restore failure", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser)
      .mockRejectedValueOnce(new Error("Unable to load your account."))
      .mockResolvedValueOnce(sampleUser)

    renderWithProviders(<SettingsBoard />)

    expect(
      await screen.findByText("Couldn’t load your account"),
    ).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("ava@acme.example")).toBeInTheDocument()
    expect(fetchCurrentUser).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem("access_token")).toBe("test-token")
  })
})
