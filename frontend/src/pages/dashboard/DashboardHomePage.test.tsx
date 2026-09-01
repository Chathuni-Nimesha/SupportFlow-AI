import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { DashboardHomePage } from "@/pages/dashboard/DashboardHomePage"
import { fetchCurrentUser } from "@/services/auth"
import { listConversations } from "@/services/conversations"
import { makeConversationApi, sampleUser } from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

vi.mock("@/services/conversations", () => ({
  listConversations: vi.fn(),
}))

describe("DashboardHomePage", () => {
  it("renders the dashboard and unavailable panels", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)
    vi.mocked(listConversations).mockResolvedValue([])

    renderWithProviders(<DashboardHomePage />)

    expect(await screen.findByText("Welcome back")).toBeInTheDocument()
    expect(screen.getByText("Total Conversations")).toBeInTheDocument()
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        "Tickets are not available yet. There is no tickets backend connected.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "AI performance trends are not available yet. No resolution-rate backend exists.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Activity tracking is not available yet. No activity API exists.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText("VIP customer")).not.toBeInTheDocument()
  })

  it("shows a loading state for conversation data", async () => {
    const pending = deferred<ReturnType<typeof makeConversationApi>[]>()
    vi.mocked(listConversations).mockReturnValue(pending.promise)

    renderWithProviders(<DashboardHomePage />)

    expect(await screen.findByText("Loading conversations…")).toBeInTheDocument()
    expect(screen.getByText("Loading")).toBeInTheDocument()

    pending.resolve([])
    await waitFor(() => {
      expect(screen.queryByText("Loading conversations…")).not.toBeInTheDocument()
    })
  })

  it("displays the live conversation count from the API", async () => {
    vi.mocked(listConversations).mockResolvedValue([
      makeConversationApi(),
      makeConversationApi({ id: "conv-2", customer_name: "Noah Diaz" }),
    ])

    renderWithProviders(<DashboardHomePage />)

    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
    expect(screen.getByText("Noah Diaz")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("Live")).toBeInTheDocument()
    expect(screen.queryByText("Open Tickets")).toBeInTheDocument()
    expect(screen.getByText("No tickets backend yet")).toBeInTheDocument()
  })

  it("shows an error state when conversations fail to load", async () => {
    const user = userEvent.setup()
    vi.mocked(listConversations)
      .mockRejectedValueOnce(new Error("Unable to load conversations."))
      .mockResolvedValueOnce([])

    renderWithProviders(<DashboardHomePage />)

    expect(
      await screen.findByText("Couldn’t load conversations"),
    ).toBeInTheDocument()
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)

    await user.click(screen.getByRole("button", { name: "Retry" }))
    await waitFor(() => {
      expect(listConversations).toHaveBeenCalledTimes(2)
    })
  })
})
