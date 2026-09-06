import { describe, expect, it } from "vitest"

import {
  assigneeLabel,
  conversationHasOpenTickets,
  conversationTicketsAllResolved,
  emptyTicketFormValues,
  ticketConversationLabel,
  ticketCustomerName,
  ticketFormFromConversation,
  ticketNeedsConversationResolution,
  toCreatePayload,
  toUpdatePayload,
  validateTicketForm,
} from "@/lib/ticket-mappers"
import type { TicketFormValues } from "@/types/tickets"
import { makeTicket } from "@/test/fixtures"

describe("ticket mappers", () => {
  it("builds a customer display name from the ticket summary", () => {
    expect(ticketCustomerName(makeTicket())).toBe("Elena Park")
    expect(
      ticketCustomerName(makeTicket({ customer: null })),
    ).toBe("Unknown customer")
  })

  it("validates required ticket fields", () => {
    expect(validateTicketForm(emptyTicketFormValues())).toBe(
      "Select a customer.",
    )
    expect(
      validateTicketForm({
        ...emptyTicketFormValues(),
        customer_id: "cust-1",
      }),
    ).toBe("Title is required.")
    expect(
      validateTicketForm({
        ...emptyTicketFormValues(),
        customer_id: "cust-1",
        title: "Refund",
      }),
    ).toBe("Description is required.")
    expect(
      validateTicketForm({
        customer_id: "cust-1",
        conversation_id: "",
        title: "Refund",
        description: "Paid twice",
        status: "OPEN",
        priority: "HIGH",
        assignee_id: "",
        resolution_note: "",
      }),
    ).toBeNull()
    expect(
      validateTicketForm({
        customer_id: "cust-1",
        conversation_id: "",
        title: "Refund",
        description: "Paid twice",
        status: "DONE" as TicketFormValues["status"],
        priority: "HIGH",
        assignee_id: "",
        resolution_note: "",
      }),
    ).toBe("Invalid status.")
    expect(
      validateTicketForm({
        customer_id: "cust-1",
        conversation_id: "",
        title: "Refund",
        description: "Paid twice",
        status: "OPEN",
        priority: "CRITICAL" as TicketFormValues["priority"],
        assignee_id: "",
        resolution_note: "",
      }),
    ).toBe("Invalid priority.")
  })

  it("omits a blank assignee from create payloads", () => {
    expect(
      toCreatePayload({
        customer_id: "cust-1",
        conversation_id: "",
        title: " Refund ",
        description: "Paid twice",
        status: "OPEN",
        priority: "HIGH",
        assignee_id: "  ",
        resolution_note: "",
      }),
    ).toEqual({
      customer_id: "cust-1",
      title: "Refund",
      description: "Paid twice",
      status: "OPEN",
      priority: "HIGH",
      assignee_id: null,
    })
  })

  it("includes conversation_id on create only when selected", () => {
    expect(
      toCreatePayload({
        ...emptyTicketFormValues(),
        customer_id: "cust-1",
        conversation_id: "conv-1",
        title: "Refund",
        description: "Paid twice",
      }),
    ).toMatchObject({ conversation_id: "conv-1" })
    expect(
      toCreatePayload({
        ...emptyTicketFormValues(),
        customer_id: "cust-1",
        title: "Refund",
        description: "Paid twice",
      }),
    ).not.toHaveProperty("conversation_id")
  })

  it("sends conversation_id null on update to unlink", () => {
    expect(
      toUpdatePayload({
        ...emptyTicketFormValues(),
        customer_id: "cust-1",
        title: "Refund",
        description: "Paid twice",
      }),
    ).toMatchObject({ conversation_id: null })
  })

  it("labels assignees from the team summary", () => {
    expect(assigneeLabel(makeTicket())).toBe("Unassigned")
    expect(
      assigneeLabel(
        makeTicket({
          assignee_id: "member-1",
          assignee: {
            id: "member-1",
            first_name: "Sarah",
            last_name: "Perera",
            email: "sarah@acme.example",
            role: "AGENT",
          },
        }),
      ),
    ).toBe("Sarah Perera")
  })

  it("labels linked conversations from the ticket id", () => {
    expect(ticketConversationLabel(makeTicket())).toBe("Not linked")
    expect(
      ticketConversationLabel(makeTicket({ conversation_id: "conv-1" })),
    ).toBe("Linked · conv-1")
  })

  it("prefills a ticket form from a conversation without inventing a customer", () => {
    expect(
      ticketFormFromConversation({
        id: "conv-1",
        subject: "Refund request",
        lastMessage: "Can I request a refund?",
      }),
    ).toMatchObject({
      customer_id: "",
      conversation_id: "conv-1",
      title: "Refund request",
      description: "Can I request a refund?",
      assignee_id: "",
    })
    expect(
      ticketFormFromConversation({
        id: "conv-1",
        customerId: "cust-1",
        subject: "Refund request",
        lastMessage: "Can I request a refund?",
      }).customer_id,
    ).toBe("cust-1")
  })

  it("prefills the ticket assignee from an active conversation agent", () => {
    expect(
      ticketFormFromConversation({
        id: "conv-1",
        subject: "Refund request",
        assignedAgentId: "member-1",
      }).assignee_id,
    ).toBe("member-1")
    expect(
      ticketFormFromConversation(
        {
          id: "conv-1",
          subject: "Refund request",
          assignedAgentId: "member-1",
        },
        { assignableMemberIds: ["member-2"] },
      ).assignee_id,
    ).toBe("")
  })

  it("represents conversation and ticket resolution mismatch", () => {
    expect(
      ticketNeedsConversationResolution(
        makeTicket({
          conversation_id: "conv-1",
          status: "RESOLVED",
          conversation_status: "Open",
          conversation_needs_resolution: true,
        }),
      ),
    ).toBe(true)
    expect(
      ticketNeedsConversationResolution(
        makeTicket({
          conversation_id: "conv-1",
          status: "CLOSED",
          conversation_status: "Closed",
          conversation_needs_resolution: false,
        }),
      ),
    ).toBe(false)
    expect(
      conversationHasOpenTickets([makeTicket({ status: "IN_PROGRESS" })]),
    ).toBe(true)
    expect(
      conversationTicketsAllResolved([makeTicket({ status: "RESOLVED" })]),
    ).toBe(true)
  })

  it("includes a resolution note on create only when provided", () => {
    expect(
      toCreatePayload({
        ...emptyTicketFormValues(),
        customer_id: "cust-1",
        title: "Refund",
        description: "Paid twice",
        status: "RESOLVED",
        resolution_note: " Refund issued. ",
      }),
    ).toMatchObject({ resolution_note: "Refund issued." })
    expect(
      toCreatePayload({
        ...emptyTicketFormValues(),
        customer_id: "cust-1",
        title: "Refund",
        description: "Paid twice",
      }),
    ).not.toHaveProperty("resolution_note")
  })
})
