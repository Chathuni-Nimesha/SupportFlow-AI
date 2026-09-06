import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"

import { TicketDetailPanel } from "@/components/tickets/ticket-detail"
import { makeTeamMember, makeTicket } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

describe("TicketDetailPanel", () => {
  it("shows customer, status, priority, assignee, and unlinked conversation", () => {
    renderWithProviders(
      <TicketDetailPanel
        ticket={makeTicket()}
        onEdit={vi.fn()}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        members={[makeTeamMember()]}
      />,
    )

    expect(screen.getByText("Customer")).toBeInTheDocument()
    expect(screen.getByText("Elena Park")).toBeInTheDocument()
    expect(screen.getByText("elena@acme.example")).toBeInTheDocument()
    expect(screen.getByLabelText("Status")).toHaveValue("OPEN")
    expect(screen.getByLabelText("Priority")).toHaveValue("HIGH")
    expect(screen.getByText("Ticket assignee")).toBeInTheDocument()
    expect(screen.getByLabelText("Assignee")).toHaveDisplayValue("Unassigned")
    expect(screen.getByText("Linked conversation")).toBeInTheDocument()
    expect(screen.getByText("Not linked")).toBeInTheDocument()
  })

  it("links a conversation id to the inbox without changing ticket data", () => {
    renderWithProviders(
      <TicketDetailPanel
        ticket={makeTicket({ conversation_id: "conv-42" })}
        onEdit={vi.fn()}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        members={[]}
      />,
    )

    expect(screen.getByText("Linked · conv-42")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Open conversation" }),
    ).toHaveAttribute("href", "/dashboard/conversations?conversation=conv-42")
    expect(
      screen.getByText(
        /Changing the ticket assignee does not change the conversation agent/,
      ),
    ).toBeInTheDocument()
  })

  it("warns when a resolved ticket still has an open conversation", () => {
    renderWithProviders(
      <TicketDetailPanel
        ticket={makeTicket({
          conversation_id: "conv-42",
          status: "RESOLVED",
          conversation_status: "Open",
          conversation_needs_resolution: true,
        })}
        onEdit={vi.fn()}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        members={[]}
      />,
    )

    expect(
      screen.getByRole("status"),
    ).toHaveTextContent("Close the conversation separately")
  })

  it("displays workflow update errors", () => {
    renderWithProviders(
      <TicketDetailPanel
        ticket={makeTicket()}
        onEdit={vi.fn()}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onPriorityChange={vi.fn()}
        onAssigneeChange={vi.fn()}
        members={[]}
        error="Assignee is not an active team member."
      />,
    )

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Assignee is not an active team member.")
  })
})
