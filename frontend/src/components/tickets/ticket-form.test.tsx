import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import { TicketForm } from "@/components/tickets/ticket-form"
import { emptyTicketFormValues } from "@/lib/ticket-mappers"
import { makeConversationApi, makeCustomer, makeTeamMember } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

describe("TicketForm conversation selector", () => {
  it("aligns customer when a conversation already has a customer_id", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const customer = makeCustomer({ id: "cust-2", first_name: "Noah" })
    const conversation = makeConversationApi({
      id: "conv-2",
      customer_id: customer.id,
      customer_name: "Noah Diaz",
      subject: "Billing question",
    })

    renderWithProviders(
      <TicketForm
        values={emptyTicketFormValues()}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="Create ticket"
        customers={[makeCustomer(), customer]}
        conversations={[conversation]}
        members={[makeTeamMember()]}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText("Conversation (optional)"),
      conversation.id,
    )
    expect(onChange).toHaveBeenCalledWith({
      ...emptyTicketFormValues(),
      conversation_id: conversation.id,
      customer_id: customer.id,
    })
  }, 10_000)

  it("prefills assignee from an active conversation agent", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const member = makeTeamMember()
    const conversation = makeConversationApi({
      id: "conv-4",
      assigned_agent_id: member.id,
      subject: "Assigned thread",
    })

    renderWithProviders(
      <TicketForm
        values={emptyTicketFormValues()}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="Create ticket"
        customers={[makeCustomer()]}
        conversations={[conversation]}
        members={[member]}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText("Conversation (optional)"),
      conversation.id,
    )
    expect(onChange).toHaveBeenCalledWith({
      ...emptyTicketFormValues(),
      conversation_id: conversation.id,
      assignee_id: member.id,
    })
  })

  it("does not invent a customer when the conversation is unlinked", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const conversation = makeConversationApi({
      id: "conv-3",
      customer_id: null,
      subject: "Unlinked thread",
    })

    renderWithProviders(
      <TicketForm
        values={{ ...emptyTicketFormValues(), customer_id: "cust-1" }}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="Create ticket"
        customers={[makeCustomer()]}
        conversations={[conversation]}
        members={[makeTeamMember()]}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText("Conversation (optional)"),
      conversation.id,
    )
    expect(onChange).toHaveBeenCalledWith({
      ...emptyTicketFormValues(),
      customer_id: "cust-1",
      conversation_id: conversation.id,
    })
  })

  it("displays ticket workflow errors", () => {
    renderWithProviders(
      <TicketForm
        values={emptyTicketFormValues()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="Create ticket"
        customers={[makeCustomer()]}
        members={[makeTeamMember()]}
        error="Ticket customer does not match the linked conversation's customer."
      />,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ticket customer does not match the linked conversation's customer.",
    )
  })
})
