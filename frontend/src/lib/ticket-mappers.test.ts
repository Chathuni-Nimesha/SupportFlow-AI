import { describe, expect, it } from "vitest"

import {
  assigneeLabel,
  emptyTicketFormValues,
  ticketConversationLabel,
  ticketCustomerName,
  ticketFormFromConversation,
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
})
