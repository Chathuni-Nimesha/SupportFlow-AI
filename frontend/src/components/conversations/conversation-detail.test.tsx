import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"

import { ConversationDetail } from "@/components/conversations/conversation-detail"
import { makeConversation, makeTicket, makeUiMessage } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

describe("ConversationDetail", () => {
  it("asks the user to select a conversation when none is active", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={null}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.getByText("Select a conversation")).toBeInTheDocument()
    expect(
      screen.getByText("Choose a thread from the list to read messages and reply."),
    ).toBeInTheDocument()
  })

  it("renders conversation details and messages", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation({
          messages: [makeUiMessage()],
        })}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Elena Park" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Can I request a refund?")).toBeInTheDocument()
    expect(screen.getByLabelText("Reply message")).toBeInTheDocument()
  })

  it("shows linked tickets and a create action", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation()}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        linkedTickets={[
          makeTicket({ title: "Refund not received", status: "OPEN" }),
        ]}
        onCreateTicket={vi.fn()}
      />,
    )

    expect(screen.getByText("Linked tickets")).toBeInTheDocument()
    expect(screen.getByText("Refund not received")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Create ticket" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /Refund not received/ }),
    ).toHaveAttribute("href", "/dashboard/tickets")
  })

  it("does not invent tickets when none are linked", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation()}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onCreateTicket={vi.fn()}
      />,
    )

    expect(
      screen.getByText(/No linked tickets yet/),
    ).toBeInTheDocument()
  })

  it("shows a messages loading state", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation()}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        isMessagesLoading
      />,
    )

    expect(screen.getByText("Loading messages…")).toBeInTheDocument()
  })
})
