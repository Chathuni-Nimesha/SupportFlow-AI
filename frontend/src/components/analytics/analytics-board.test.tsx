import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { AnalyticsBoard } from "@/components/analytics/analytics-board"
import { listConversations } from "@/services/conversations"
import { makeConversationApi,
  asPage,
} from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/conversations", () => ({
  listConversations: vi.fn(),
}))

describe("AnalyticsBoard", () => {
  it("shows a loading state", async () => {
    const pending = deferred<ReturnType<typeof asPage<ReturnType<typeof makeConversationApi>>>>()
    vi.mocked(listConversations).mockReturnValue(pending.promise)

    renderWithProviders(<AnalyticsBoard />)

    expect(
      await screen.findByText("Loading conversation analytics…"),
    ).toBeInTheDocument()
    pending.resolve(asPage([]))
    await waitFor(() => {
      expect(
        screen.queryByText("Loading conversation analytics…"),
      ).not.toBeInTheDocument()
    })
  })

  it("shows an empty state and unavailable analytics", async () => {
    vi.mocked(listConversations).mockResolvedValue(asPage([]))

    renderWithProviders(<AnalyticsBoard />)

    expect(await screen.findByText("No conversations yet")).toBeInTheDocument()
    expect(screen.getByText("Ticket analytics")).toBeInTheDocument()
    expect(screen.getByText("CSAT")).toBeInTheDocument()
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0)
    expect(screen.queryByText("Channel breakdown")).not.toBeInTheDocument()
  })

  it("displays status counts and channel breakdown from API data", async () => {
    vi.mocked(listConversations).mockResolvedValue(asPage([
      makeConversationApi({ id: "1", status: "Open", channel: "Email" }),
      makeConversationApi({ id: "2", status: "Waiting", channel: "Chat" }),
      makeConversationApi({ id: "3", status: "Open", channel: "Email" }),
    ]))

    renderWithProviders(<AnalyticsBoard />)

    expect(await screen.findByText("Channel breakdown")).toBeInTheDocument()
    expect(screen.getByText("Open Conversations")).toBeInTheDocument()
    expect(screen.getByText("Waiting Conversations")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Chat")).toBeInTheDocument()
    expect(screen.queryByText("Slack")).not.toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Not available").length).toBeGreaterThan(0)
  })

  it("shows an error with retry", async () => {
    const user = userEvent.setup()
    vi.mocked(listConversations)
      .mockRejectedValueOnce(new Error("Analytics unavailable"))
      .mockResolvedValueOnce(asPage([]))

    renderWithProviders(<AnalyticsBoard />)

    expect(await screen.findByText("Couldn’t load analytics")).toBeInTheDocument()
    expect(screen.getByText("Analytics unavailable")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("No conversations yet")).toBeInTheDocument()
  })
})
