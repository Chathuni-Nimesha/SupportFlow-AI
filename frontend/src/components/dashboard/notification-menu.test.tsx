import { describe, expect, it } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import { NotificationMenu } from "@/components/dashboard/notification-menu"
import { renderWithProviders } from "@/test/test-utils"

describe("NotificationMenu", () => {
  it("opens and shows the empty unavailable state", async () => {
    const user = userEvent.setup()
    renderWithProviders(<NotificationMenu />)

    await user.click(screen.getByRole("button", { name: "Open notifications" }))

    expect(await screen.findByText("Notifications")).toBeInTheDocument()
    expect(screen.getByText("No notifications yet")).toBeInTheDocument()
    expect(
      screen.getByText("Notifications are not connected to a backend yet."),
    ).toBeInTheDocument()
    expect(screen.queryByText("VIP")).not.toBeInTheDocument()
    expect(screen.queryByText("CSAT")).not.toBeInTheDocument()
  })
})
