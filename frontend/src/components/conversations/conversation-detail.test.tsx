import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import { ConversationDetail } from "@/components/conversations/conversation-detail"
import { makeConversation, makeTeamMember, makeTicket, makeUiMessage } from "@/test/fixtures"
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
    expect(screen.getByText(/Agent: Unassigned/)).toBeInTheDocument()
  })

  it("hides the reply composer when the conversation is closed", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation({
          status: "Closed",
          messages: [makeUiMessage()],
        })}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText("Reply message")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(
      "This conversation is closed",
    )
  })

  it("hides the reply composer when the conversation is AI Resolved", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation({ status: "AI Resolved" })}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText("Reply message")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("AI Resolved")
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
    ).toHaveAttribute("href", "/dashboard/tickets?ticket=tkt-1")
    expect(
      screen.getByText(/Ticket assignees stay independent/),
    ).toBeInTheDocument()
  })

  it("warns when a closed conversation still has open tickets", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation({ status: "Closed" })}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        linkedTickets={[makeTicket({ status: "OPEN" })]}
        onCreateTicket={vi.fn()}
      />,
    )

    expect(screen.getByText(/Linked tickets are still open/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Reply message")).not.toBeInTheDocument()
  })

  it("warns when linked tickets are resolved but the conversation is still open", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation({ status: "Open" })}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        linkedTickets={[makeTicket({ status: "RESOLVED" })]}
        onCreateTicket={vi.fn()}
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(
      "Close this conversation separately",
    )
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

  it("lets the user assign and unassign an agent", async () => {
    const onAssigneeChange = vi.fn()
    const { rerender } = renderWithProviders(
      <ConversationDetail
        conversation={makeConversation()}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onAssigneeChange={onAssigneeChange}
        members={[makeTeamMember()]}
        assignedAgentLabel="Unassigned"
      />,
    )

    expect(screen.getByLabelText("Assigned agent")).toHaveValue("")
    expect(screen.getByText(/Agent: Unassigned/)).toBeInTheDocument()

    await userEvent.setup().selectOptions(
      screen.getByLabelText("Assigned agent"),
      "member-1",
    )
    expect(onAssigneeChange).toHaveBeenCalledWith("member-1")

    rerender(
      <ConversationDetail
        conversation={makeConversation({ assignedAgentId: "member-1" })}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        onAssigneeChange={onAssigneeChange}
        members={[makeTeamMember()]}
        assignedAgentLabel="Sarah Perera"
      />,
    )

    expect(screen.getByLabelText("Assigned agent")).toHaveValue("member-1")
    expect(screen.getByText(/Agent: Sarah Perera/)).toBeInTheDocument()

    await userEvent.setup().selectOptions(
      screen.getByLabelText("Assigned agent"),
      "",
    )
    expect(onAssigneeChange).toHaveBeenCalledWith(null)
  })
})
