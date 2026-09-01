import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"

import { TicketsBoard } from "@/components/tickets/tickets-board"
import { renderWithProviders } from "@/test/test-utils"

describe("TicketsBoard", () => {
  it("renders an honest unavailable state without fake ticket rows", () => {
    renderWithProviders(<TicketsBoard />)

    expect(screen.getByRole("heading", { name: "Tickets" })).toBeInTheDocument()
    expect(
      screen.getByText(
        "Tickets are not available yet. There is no tickets backend connected.",
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText("Not available").length).toBeGreaterThanOrEqual(4)
    expect(screen.getByRole("button", { name: "Create ticket" })).toBeDisabled()
    expect(screen.getByLabelText("Search tickets")).toBeDisabled()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText("TKT-")).not.toBeInTheDocument()
  })
})
