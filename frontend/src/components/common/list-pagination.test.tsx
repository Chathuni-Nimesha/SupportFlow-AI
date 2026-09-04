import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { render, screen } from "@testing-library/react"

import { ListPagination } from "@/components/common/list-pagination"

describe("ListPagination", () => {
  it("hides controls on a single full page", () => {
    render(
      <ListPagination
        page={1}
        pageSize={20}
        total={3}
        hasNext={false}
        onPageChange={vi.fn()}
        itemLabel="customers"
      />,
    )
    expect(screen.getByText("Showing 1–3 of 3 customers")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument()
  })

  it("moves to the next page", async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <ListPagination
        page={1}
        pageSize={20}
        total={40}
        hasNext
        onPageChange={onPageChange}
        itemLabel="customers"
      />,
    )
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})
