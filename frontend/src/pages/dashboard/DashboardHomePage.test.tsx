import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { DashboardHomePage } from "@/pages/dashboard/DashboardHomePage"
import { fetchCurrentUser } from "@/services/auth"
import { listConversations } from "@/services/conversations"
import { listTickets } from "@/services/tickets"
import {
  makeConversationApi,
  makeTicket,
  sampleUser,
} from "@/test/fixtures"
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

vi.mock("@/services/tickets", () => ({
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
}))

describe("DashboardHomePage", () => {
  it("renders the dashboard and unavailable panels", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)
    vi.mocked(listConversations).mockResolvedValue([])
    vi.mocked(listTickets).mockResolvedValue([])

    renderWithProviders(<DashboardHomePage />)

    expect(await screen.findByText("Welcome back")).toBeInTheDocument()
    expect(screen.getByText("Total Conversations")).toBeInTheDocument()
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0)
    expect(screen.getByText("No tickets yet")).toBeInTheDocument()
    expect(
      screen.getByText("Create a ticket to see recent issues here."),
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
    vi.mocked(listTickets).mockResolvedValue([])

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
    vi.mocked(listTickets).mockResolvedValue([])

    renderWithProviders(<DashboardHomePage />)

    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
    expect(screen.getByText("Noah Diaz")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0)
    expect(screen.getByText("Open Tickets")).toBeInTheDocument()
    expect(screen.getByText("OPEN tickets in your workspace")).toBeInTheDocument()
  })

  it("displays live tickets on the home dashboard", async () => {
    vi.mocked(listConversations).mockResolvedValue([])
    vi.mocked(listTickets).mockResolvedValue([
      makeTicket(),
      makeTicket({ id: "tkt-2", status: "RESOLVED", title: "Password reset" }),
    ])

    renderWithProviders(<DashboardHomePage />)

    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
    expect(screen.getByText("Password reset")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("shows an error state when conversations fail to load", async () => {
    const user = userEvent.setup()
    vi.mocked(listTickets).mockResolvedValue([])
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
