import { describe, expect, it } from "vitest"

import {
  assigneeLabel,
  emptyTicketFormValues,
  ticketCustomerName,
  toCreatePayload,
  validateTicketForm,
} from "@/lib/ticket-mappers"
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
        title: "Refund",
        description: "Paid twice",
        status: "OPEN",
        priority: "HIGH",
        assignee_id: "",
      }),
    ).toBeNull()
  })

  it("omits a blank assignee from create payloads", () => {
    expect(
      toCreatePayload({
        customer_id: "cust-1",
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
})
