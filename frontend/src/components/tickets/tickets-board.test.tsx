import { AxiosError } from "axios"
import type { InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor, within } from "@testing-library/react"

import { TicketsBoard } from "@/components/tickets/tickets-board"
import { listCustomers } from "@/services/customers"
import { listConversations } from "@/services/conversations"
import { listTeamMembers } from "@/services/team"
import {
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  updateTicket,
} from "@/services/tickets"
import { makeCustomer, makeOwnerMember, makeTeamMember, makeTicket,
  makeAgentUser,
  asPage,
} from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"
import { fetchCurrentUser } from "@/services/auth"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

vi.mock("@/services/customers", () => ({
  listCustomers: vi.fn(),
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
}))

vi.mock("@/services/conversations", () => ({
  listConversations: vi.fn(),
}))

vi.mock("@/services/tickets", () => ({
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
}))

vi.mock("@/services/team", () => ({
  listTeamMembers: vi.fn(),
  getTeamMember: vi.fn(),
  createTeamMember: vi.fn(),
  updateTeamMember: vi.fn(),
  deleteTeamMember: vi.fn(),
}))

function apiError(detail: string, status = 400) {
  return new AxiosError(
    detail,
    AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    {
      status,
      statusText: "Bad Request",
      data: { detail },
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig,
    },
  )
}

describe("TicketsBoard", () => {
  beforeEach(() => {
    vi.mocked(listTickets).mockReset()
    vi.mocked(getTicket).mockReset()
    vi.mocked(createTicket).mockReset()
    vi.mocked(updateTicket).mockReset()
    vi.mocked(deleteTicket).mockReset()
    vi.mocked(listCustomers).mockReset()
    vi.mocked(listCustomers).mockResolvedValue(asPage([makeCustomer()]))
    vi.mocked(listConversations).mockReset()
    vi.mocked(listConversations).mockResolvedValue(asPage([]))
    vi.mocked(listTeamMembers).mockReset()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([
      makeOwnerMember(),
      makeTeamMember(),
    ]))
  })

  it("renders the tickets board chrome", async () => {
    vi.mocked(listTickets).mockResolvedValue(asPage([]))

    renderWithProviders(<TicketsBoard />)

    expect(
      await screen.findByRole("heading", { name: "Tickets" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New ticket" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Search tickets")).toBeInTheDocument()
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument()
    expect(screen.queryByText("Not available")).not.toBeInTheDocument()
  })

  it("shows a loading state while tickets are fetched", async () => {
    const pending = deferred<ReturnType<typeof asPage<ReturnType<typeof makeTicket>>>>()
    vi.mocked(listTickets).mockReturnValue(pending.promise)

    renderWithProviders(<TicketsBoard />)

    expect(await screen.findByText("Loading tickets…")).toBeInTheDocument()

    pending.resolve(asPage([]))
    expect(await screen.findByText("No tickets yet")).toBeInTheDocument()
  })

  it("shows an empty state when there are no tickets", async () => {
    vi.mocked(listTickets).mockResolvedValue(asPage([]))

    renderWithProviders(<TicketsBoard />)

    expect(await screen.findByText("No tickets yet")).toBeInTheDocument()
    expect(screen.queryByText("Refund not received")).not.toBeInTheDocument()
  })

  it("renders tickets from the API", async () => {
    vi.mocked(listTickets).mockResolvedValue(asPage([makeTicket()]))

    renderWithProviders(<TicketsBoard />)

    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
    expect(screen.getByText(/Elena Park/)).toBeInTheDocument()
  })

  it("shows a list error and retries", async () => {
    const user = userEvent.setup()
    vi.mocked(listTickets)
      .mockRejectedValueOnce(new Error("Unable to load tickets."))
      .mockResolvedValueOnce(asPage([makeTicket()]))

    renderWithProviders(<TicketsBoard />)

    expect(await screen.findByText("Couldn’t load tickets")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
    expect(listTickets).toHaveBeenCalledTimes(2)
  })

  it(
    "creates a ticket and shows it in the list",
    async () => {
    const user = userEvent.setup()
    vi.mocked(listTickets).mockResolvedValue(asPage([]))
    const created = makeTicket({ id: "tkt-created" })
    vi.mocked(createTicket).mockImplementation(async () => {
      vi.mocked(listTickets).mockResolvedValue(asPage([created]))
      return created
    })

    renderWithProviders(<TicketsBoard />)
    await screen.findByText("No tickets yet")

    await user.click(screen.getByRole("button", { name: "New ticket" }))
    expect(
      await screen.findByRole("heading", { name: "New ticket" }),
    ).toBeInTheDocument()
    expect(
      await screen.findByRole("option", { name: /Elena Park/ }),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText("Customer"), "cust-1")
    await user.type(screen.getByLabelText("Title"), "Refund not received")
    await user.type(screen.getByLabelText("Description"), "Paid twice")
    await user.click(screen.getByRole("button", { name: "Create ticket" }))

    await waitFor(() => {
      expect(createTicket).toHaveBeenCalledWith({
        customer_id: "cust-1",
        title: "Refund not received",
        description: "Paid twice",
        status: "OPEN",
        priority: "MEDIUM",
        assignee_id: null,
      })
    })
    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
    },
    10_000,
  )

  it("validates required fields before creating", async () => {
    const user = userEvent.setup()
    vi.mocked(listTickets).mockResolvedValue(asPage([]))

    renderWithProviders(<TicketsBoard />)
    await user.click(await screen.findByRole("button", { name: "New ticket" }))
    await screen.findByRole("heading", { name: "New ticket" })

    await user.click(screen.getByRole("button", { name: "Create ticket" }))

    expect(await screen.findByText("Select a customer.")).toBeInTheDocument()
    expect(createTicket).not.toHaveBeenCalled()
  })

  it("opens ticket details", async () => {
    const user = userEvent.setup()
    const ticket = makeTicket()
    vi.mocked(listTickets).mockResolvedValue(asPage([ticket]))
    vi.mocked(getTicket).mockResolvedValue(ticket)

    renderWithProviders(<TicketsBoard />)
    await screen.findByText("Refund not received")

    await user.click(
      screen.getByRole("button", { name: "View Refund not received" }),
    )

    const dialog = await screen.findByRole("dialog")
    expect(
      await within(dialog).findByText("Refund not received"),
    ).toBeInTheDocument()
    expect(within(dialog).getByText("Customer")).toBeInTheDocument()
    expect(within(dialog).getByText(/Elena Park/)).toBeInTheDocument()
    expect(within(dialog).getByText("Linked conversation")).toBeInTheDocument()
    expect(within(dialog).getByText("Not linked")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: "View customer" }),
    ).toHaveAttribute("href", "/dashboard/customers?customer=cust-1")
  })

  it("populates the edit form and saves changes", async () => {
    const user = userEvent.setup()
    const ticket = makeTicket()
    vi.mocked(listTickets).mockResolvedValue(asPage([ticket]))
    const updated = makeTicket({ title: "Duplicate charge" })
    vi.mocked(updateTicket).mockImplementation(async () => {
      vi.mocked(listTickets).mockResolvedValue(asPage([updated]))
      return updated
    })

    renderWithProviders(<TicketsBoard />)
    await user.click(
      await screen.findByRole("button", { name: "Edit Refund not received" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Edit ticket" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveValue("Refund not received")

    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Duplicate charge")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(updateTicket).toHaveBeenCalledWith(
        "tkt-1",
        expect.objectContaining({ title: "Duplicate charge" }),
      )
    })
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Edit ticket" }),
      ).not.toBeInTheDocument()
    })
  })

  it("changes status from ticket details", async () => {
    const user = userEvent.setup()
    const ticket = makeTicket()
    vi.mocked(listTickets).mockResolvedValue(asPage([ticket]))
    vi.mocked(getTicket).mockResolvedValue(ticket)
    vi.mocked(updateTicket).mockResolvedValue(
      makeTicket({ status: "IN_PROGRESS" }),
    )

    renderWithProviders(<TicketsBoard />)
    await user.click(
      await screen.findByRole("button", { name: "View Refund not received" }),
    )

    const dialog = await screen.findByRole("dialog")
    const status = await within(dialog).findByLabelText("Status")
    await user.selectOptions(status, "IN_PROGRESS")

    await waitFor(() => {
      expect(updateTicket).toHaveBeenCalledWith("tkt-1", {
        status: "IN_PROGRESS",
      })
    })
  })

  it("confirms deletion and removes the ticket from the list", async () => {
    const user = userEvent.setup()
    vi.mocked(listTickets).mockResolvedValue(asPage([makeTicket()]))
    vi.mocked(deleteTicket).mockImplementation(async () => {
      vi.mocked(listTickets).mockResolvedValue(asPage([]))
    })

    renderWithProviders(<TicketsBoard />)
    await screen.findByText("Refund not received")

    await user.click(
      screen.getByRole("button", { name: "Delete Refund not received" }),
    )
    expect(await screen.findByText(/This cannot be undone/)).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Delete ticket" }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(deleteTicket).toHaveBeenCalledWith("tkt-1")
    })
    expect(await screen.findByText("No tickets yet")).toBeInTheDocument()
  })

  it("filters tickets by status through the API", async () => {
    const user = userEvent.setup()
    const open = makeTicket()
    const resolved = makeTicket({
      id: "tkt-2",
      title: "Password reset",
      status: "RESOLVED",
    })
    vi.mocked(listTickets).mockImplementation(async (params = {}) => {
      if (params.status === "RESOLVED") return asPage([resolved])
      return asPage([open, resolved])
    })

    renderWithProviders(<TicketsBoard />)
    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
    expect(screen.getByText("Password reset")).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText("Filter by status"), "RESOLVED")

    await waitFor(() => {
      expect(listTickets).toHaveBeenCalledWith(
        expect.objectContaining({ status: "RESOLVED" }),
      )
    })
    expect(await screen.findByText("Password reset")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Refund not received")).not.toBeInTheDocument()
    })
  })

  it("searches tickets through the API", async () => {
    const user = userEvent.setup()
    const refund = makeTicket()
    vi.mocked(listTickets).mockImplementation(async (params = {}) => {
      if (params.query === "duplicate") return asPage([refund])
      if (params.query) return asPage([])
      return asPage([refund, makeTicket({ id: "tkt-2", title: "Password reset" })])
    })

    renderWithProviders(<TicketsBoard />)
    expect(await screen.findByText("Password reset")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Search tickets"), "duplicate")

    await waitFor(
      () => {
        expect(listTickets).toHaveBeenCalledWith(
          expect.objectContaining({ query: "duplicate" }),
        )
      },
      { timeout: 3000 },
    )
    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Password reset")).not.toBeInTheDocument()
    })
  })

  it("loads real team members in the assignee selector", async () => {
    const user = userEvent.setup()
    vi.mocked(listTickets).mockResolvedValue(asPage([]))

    renderWithProviders(<TicketsBoard />)
    await user.click(await screen.findByRole("button", { name: "New ticket" }))
    await screen.findByRole("heading", { name: "New ticket" })

    const assignee = await screen.findByRole("combobox", { name: "Assignee" })
    expect(
      await screen.findByRole("option", { name: "Ava Chen (Owner)" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: "Sarah Perera" }),
    ).toBeInTheDocument()
    expect(within(assignee).getByRole("option", { name: "Unassigned" })).toBeInTheDocument()
    expect(screen.queryByText("Team members are not available yet.")).not.toBeInTheDocument()
  })

  it("assigns a ticket to a team member on create", async () => {
    const user = userEvent.setup()
    vi.mocked(listTickets).mockResolvedValue(asPage([]))
    const created = makeTicket({
      id: "tkt-assigned",
      assignee_id: "member-1",
      assignee: {
        id: "member-1",
        first_name: "Sarah",
        last_name: "Perera",
        email: "sarah@acme.example",
        role: "AGENT",
      },
    })
    vi.mocked(createTicket).mockImplementation(async () => {
      vi.mocked(listTickets).mockResolvedValue(asPage([created]))
      return created
    })

    renderWithProviders(<TicketsBoard />)
    await user.click(await screen.findByRole("button", { name: "New ticket" }))
    await screen.findByRole("heading", { name: "New ticket" })
    await user.selectOptions(screen.getByLabelText("Customer"), "cust-1")
    await user.type(screen.getByLabelText("Title"), "Refund not received")
    await user.type(screen.getByLabelText("Description"), "Paid twice")
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Assignee" }),
      "member-1",
    )
    await user.click(screen.getByRole("button", { name: "Create ticket" }))

    await waitFor(() => {
      expect(createTicket).toHaveBeenCalledWith(
        expect.objectContaining({ assignee_id: "member-1" }),
      )
    })
    expect(await screen.findByText("Sarah Perera")).toBeInTheDocument()
  }, 10_000)

  it("shows assigned member name on ticket details", async () => {
    const user = userEvent.setup()
    const ticket = makeTicket({
      assignee_id: "member-1",
      assignee: {
        id: "member-1",
        first_name: "Sarah",
        last_name: "Perera",
        email: "sarah@acme.example",
        role: "AGENT",
      },
    })
    vi.mocked(listTickets).mockResolvedValue(asPage([ticket]))
    vi.mocked(getTicket).mockResolvedValue(ticket)

    renderWithProviders(<TicketsBoard />)
    await user.click(
      await screen.findByRole("button", { name: "View Refund not received" }),
    )

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Ticket assignee")).toBeInTheDocument()
    expect(within(dialog).getAllByText("Sarah Perera").length).toBeGreaterThan(0)
  })

  it("shows create API errors on the ticket form", async () => {
    const user = userEvent.setup()
    vi.mocked(listTickets).mockResolvedValue(asPage([]))
    vi.mocked(createTicket).mockRejectedValue(
      apiError(
        "Ticket customer does not match the linked conversation's customer.",
      ),
    )

    renderWithProviders(<TicketsBoard />)
    await user.click(await screen.findByRole("button", { name: "New ticket" }))
    await screen.findByRole("heading", { name: "New ticket" })
    expect(
      await screen.findByRole("option", { name: /Elena Park/ }),
    ).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText("Customer"), "cust-1")
    await user.type(screen.getByLabelText("Title"), "Refund not received")
    await user.type(screen.getByLabelText("Description"), "Paid twice")
    await user.click(screen.getByRole("button", { name: "Create ticket" }))

    expect(
      await screen.findByText(
        "Ticket customer does not match the linked conversation's customer.",
      ),
    ).toBeInTheDocument()
  }, 10_000)

  it("shows detail update errors for invalid assignees", async () => {
    const user = userEvent.setup()
    const ticket = makeTicket()
    vi.mocked(listTickets).mockResolvedValue(asPage([ticket]))
    vi.mocked(getTicket).mockResolvedValue(ticket)
    vi.mocked(updateTicket).mockRejectedValue(
      apiError("Assignee is not an active team member."),
    )

    renderWithProviders(<TicketsBoard />)
    await user.click(
      await screen.findByRole("button", { name: "View Refund not received" }),
    )
    const dialog = await screen.findByRole("dialog")
    const status = await within(dialog).findByLabelText("Status")
    await user.selectOptions(status, "IN_PROGRESS")

    expect(
      await within(dialog).findByText(
        "Assignee is not an active team member.",
      ),
    ).toBeInTheDocument()
  })

  it("opens a ticket from the workspace-safe query param", async () => {
    const ticket = makeTicket({ id: "tkt-99", title: "Deep linked refund" })
    vi.mocked(listTickets).mockResolvedValue(asPage([]))
    vi.mocked(getTicket).mockResolvedValue(ticket)

    renderWithProviders(<TicketsBoard />, {
      initialEntries: ["/dashboard/tickets?ticket=tkt-99"],
    })

    const dialog = await screen.findByRole("dialog")
    expect(
      await within(dialog).findByRole("heading", { name: "Deep linked refund" }),
    ).toBeInTheDocument()
    expect(getTicket).toHaveBeenCalledWith("tkt-99")
  })

  it("shows a not-found state for a missing or foreign ticket query", async () => {
    vi.mocked(listTickets).mockResolvedValue(asPage([makeTicket()]))
    vi.mocked(getTicket).mockRejectedValue(apiError("Ticket not found.", 404))

    renderWithProviders(<TicketsBoard />, {
      initialEntries: ["/dashboard/tickets?ticket=foreign-ticket"],
    })

    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
    expect(
      await screen.findByRole("heading", { name: "Ticket not found" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "This ticket is not in your workspace, or it no longer exists.",
      ),
    ).toBeInTheDocument()
    const dialog = screen.getByRole("dialog")
    expect(
      within(dialog).queryByRole("heading", { name: "Refund not received" }),
    ).not.toBeInTheDocument()
    expect(getTicket).toHaveBeenCalledWith("foreign-ticket")
  })

  it("keeps ticket workflows available for AGENT", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(makeAgentUser())
    vi.mocked(listTickets).mockResolvedValue(asPage([makeTicket()]))

    renderWithProviders(<TicketsBoard />)

    expect(
      await screen.findByRole("heading", { name: "Tickets" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New ticket" }),
    ).toBeInTheDocument()
    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
  })
})
