import { describe, expect, it } from "vitest"
import { screen } from "@testing-library/react"

import { CustomersBoard } from "@/components/customers/customers-board"
import { renderWithProviders } from "@/test/test-utils"

describe("CustomersBoard", () => {
  it("renders an honest unavailable state without fake customer rows", () => {
    renderWithProviders(<CustomersBoard />)

    expect(screen.getByRole("heading", { name: "Customers" })).toBeInTheDocument()
    expect(
      screen.getByText("Customer management is not available yet."),
    ).toBeInTheDocument()
    expect(screen.getByText("Customer directory")).toBeInTheDocument()
    expect(screen.getAllByText("Not available").length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText("Elena Park")).not.toBeInTheDocument()
  })
})
