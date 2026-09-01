import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import { TeamBoard } from "@/components/team/team-board"
import { fetchCurrentUser } from "@/services/auth"
import { sampleUser } from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

describe("TeamBoard", () => {
  it("shows a loading state while the account is fetched", async () => {
    localStorage.setItem("access_token", "test-token")
    const pending = deferred<typeof sampleUser>()
    vi.mocked(fetchCurrentUser).mockReturnValue(pending.promise)

    renderWithProviders(<TeamBoard />)

    expect(await screen.findByText("Loading your account…")).toBeInTheDocument()
    pending.resolve(sampleUser)
    expect(await screen.findByText("Ava Chen")).toBeInTheDocument()
  })

  it("renders the signed-in user and unavailable team sections", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)

    renderWithProviders(<TeamBoard />)

    expect(await screen.findByText("Ava Chen")).toBeInTheDocument()
    expect(screen.getByText("ava@acme.example")).toBeInTheDocument()
    expect(screen.getByText("Acme Support")).toBeInTheDocument()
    expect(screen.getByText("Member directory")).toBeInTheDocument()
    expect(screen.getByText("Invitations")).toBeInTheDocument()
    expect(screen.getByText("Roles & permissions")).toBeInTheDocument()
    expect(screen.getAllByText("Not available").length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText("Invite teammate")).not.toBeInTheDocument()
  })

  it("retries the current-user request after a recoverable restore failure", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser)
      .mockRejectedValueOnce(new Error("Unable to load your account."))
      .mockResolvedValueOnce(sampleUser)

    renderWithProviders(<TeamBoard />)

    expect(
      await screen.findByText("Couldn’t load your account"),
    ).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Ava Chen")).toBeInTheDocument()
    expect(fetchCurrentUser).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem("access_token")).toBe("test-token")
  })
})
