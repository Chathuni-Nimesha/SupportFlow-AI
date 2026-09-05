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
    expect(screen.getByText("Assigned to")).toBeInTheDocument()
    expect(screen.getByLabelText("Assignee")).toHaveDisplayValue("Unassigned")
    expect(screen.getByText("Linked conversation")).toBeInTheDocument()
    expect(screen.getByText("Not linked")).toBeInTheDocument()
  })

  it("shows a linked conversation id without inventing navigation", () => {
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
