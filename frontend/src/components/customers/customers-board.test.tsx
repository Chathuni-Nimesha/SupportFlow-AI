import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { fireEvent, screen, waitFor, within } from "@testing-library/react"

import { CustomersBoard } from "@/components/customers/customers-board"
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "@/services/customers"
import { listTickets } from "@/services/tickets"
import {
  makeConversationApi,
  makeCustomer,
  makeCustomerDetail,
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

vi.mock("@/services/tickets", () => ({
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
}))

const SEARCH_DEBOUNCE_MS = 300

async function flushSearchDebounce() {
  await new Promise((resolve) => {
    window.setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50)
  })
}

describe("CustomersBoard", () => {
  beforeEach(() => {
    vi.mocked(listCustomers).mockReset()
    vi.mocked(getCustomer).mockReset()
    vi.mocked(createCustomer).mockReset()
    vi.mocked(updateCustomer).mockReset()
    vi.mocked(deleteCustomer).mockReset()
    vi.mocked(listTickets).mockReset()
    vi.mocked(listTickets).mockResolvedValue(asPage([]))
  })

  it("renders the customers board chrome", async () => {
    vi.mocked(listCustomers).mockResolvedValue(asPage([]))

    renderWithProviders(<CustomersBoard />)

    expect(
      await screen.findByRole("heading", { name: "Customers" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New customer" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Search customers")).toBeInTheDocument()
    expect(screen.queryByText("Not available")).not.toBeInTheDocument()
  })

  it("shows a loading state while customers are fetched", async () => {
    const pending = deferred<ReturnType<typeof asPage<ReturnType<typeof makeCustomer>>>>()
    vi.mocked(listCustomers).mockReturnValue(pending.promise)

    renderWithProviders(<CustomersBoard />)

    expect(screen.getByText("Loading customers…")).toBeInTheDocument()

    pending.resolve(asPage([]))
    await flushSearchDebounce()
    expect(screen.getByText("No customers yet")).toBeInTheDocument()
  })

  it("shows an empty state when there are no customers", async () => {
    vi.mocked(listCustomers).mockResolvedValue(asPage([]))

    renderWithProviders(<CustomersBoard />)

    expect(await screen.findByText("No customers yet")).toBeInTheDocument()
    expect(screen.queryByText("Elena Park")).not.toBeInTheDocument()
  })

  it("shows a list error and retries", async () => {
    const user = userEvent.setup()
    vi.mocked(listCustomers)
      .mockRejectedValueOnce(new Error("Unable to load customers."))
      .mockResolvedValueOnce(asPage([makeCustomer()]))

    renderWithProviders(<CustomersBoard />)

    expect(
      await screen.findByText("Couldn’t load customers"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
    expect(listCustomers).toHaveBeenCalledTimes(2)
  })

  it("creates a customer and shows it in the list", async () => {
    const user = userEvent.setup()
    vi.mocked(listCustomers).mockResolvedValue(asPage([]))
    const created = makeCustomer({
      id: "cust-created",
      first_name: "Noah",
      last_name: "Diaz",
      email: "noah@orbit.example",
      company: "Orbitly",
      phone: null,
      notes: null,
    })
    vi.mocked(createCustomer).mockImplementation(async () => {
      vi.mocked(listCustomers).mockResolvedValue(asPage([created]))
      return created
    })

    renderWithProviders(<CustomersBoard />)
    await screen.findByText("No customers yet")

    await user.click(screen.getByRole("button", { name: "New customer" }))
    expect(
      await screen.findByRole("heading", { name: "New customer" }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("First name"), "Noah")
    await user.type(screen.getByLabelText("Last name"), "Diaz")
    await user.type(screen.getByLabelText("Email"), "noah@orbit.example")
    await user.type(screen.getByLabelText("Company"), "Orbitly")
    await user.click(screen.getByRole("button", { name: "Create customer" }))

    await waitFor(() => {
      expect(createCustomer).toHaveBeenCalledWith({
        first_name: "Noah",
        last_name: "Diaz",
        email: "noah@orbit.example",
        phone: null,
        company: "Orbitly",
        notes: null,
      })
    })
    expect(await screen.findByText("Noah Diaz")).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "New customer" }),
    ).not.toBeInTheDocument()
  }, 10_000)

  it("keeps the create sheet open and shows an error when create fails", async () => {
    const user = userEvent.setup()
    vi.mocked(listCustomers).mockResolvedValue(asPage([]))
    vi.mocked(createCustomer).mockRejectedValue(
      new Error("Unable to create customer."),
    )

    renderWithProviders(<CustomersBoard />)
    await user.click(await screen.findByRole("button", { name: "New customer" }))

    await user.type(screen.getByLabelText("First name"), "Noah")
    await user.type(screen.getByLabelText("Last name"), "Diaz")
    await user.type(screen.getByLabelText("Email"), "noah@orbit.example")
    await user.click(screen.getByRole("button", { name: "Create customer" }))

    expect(
      await screen.findByText("Unable to create customer."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "New customer" }),
    ).toBeInTheDocument()
  }, 10_000)

  it("opens customer details including related conversations", async () => {
    const user = userEvent.setup()
    const customer = makeCustomer()
    vi.mocked(listCustomers).mockResolvedValue(asPage([customer]))
    const pending = deferred<ReturnType<typeof makeCustomerDetail>>()
    vi.mocked(getCustomer).mockReturnValue(pending.promise)

    renderWithProviders(<CustomersBoard />)
    await screen.findByText("Elena Park")

    await user.click(screen.getByRole("button", { name: "View Elena Park" }))
    expect(await screen.findByText("Loading customer…")).toBeInTheDocument()

    pending.resolve(
      makeCustomerDetail({
        conversations: [
          makeConversationApi({ subject: "Refund window" }),
        ],
      }),
    )

    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("Elena Park")).toBeInTheDocument()
    expect(within(dialog).getByText("Refund window")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: "Open conversations" }),
    ).toHaveAttribute("href", "/dashboard/conversations")
    expect(
      within(dialog).getByRole("link", { name: "Open conversation" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/conversations?conversation=conv-1",
    )
    expect(
      await within(dialog).findByText("No tickets for this customer yet."),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: "Open tickets" }),
    ).toHaveAttribute("href", "/dashboard/tickets")
  })

  it("populates the edit form and saves changes", async () => {
    const user = userEvent.setup()
    const customer = makeCustomer()
    vi.mocked(listCustomers).mockResolvedValue(asPage([customer]))
    const updated = makeCustomer({
      phone: "+1-555-0199",
      notes: "VIP",
    })
    vi.mocked(updateCustomer).mockImplementation(async () => {
      vi.mocked(listCustomers).mockResolvedValue(asPage([updated]))
      return updated
    })

    renderWithProviders(<CustomersBoard />)
    await user.click(await screen.findByRole("button", { name: "Edit Elena Park" }))

    expect(
      await screen.findByRole("heading", { name: "Edit customer" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("First name")).toHaveValue("Elena")
    expect(screen.getByLabelText("Email")).toHaveValue("elena@acme.example")

    await user.clear(screen.getByLabelText("Phone"))
    await user.type(screen.getByLabelText("Phone"), "+1-555-0199")
    await user.clear(screen.getByLabelText("Notes"))
    await user.type(screen.getByLabelText("Notes"), "VIP")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(updateCustomer).toHaveBeenCalledWith("cust-1", {
        first_name: "Elena",
        last_name: "Park",
        email: "elena@acme.example",
        phone: "+1-555-0199",
        company: "Harbor Retail",
        notes: "VIP",
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "Edit customer" }),
      ).not.toBeInTheDocument()
    })
  })

  it("confirms deletion and removes the customer from the list", async () => {
    const user = userEvent.setup()
    vi.mocked(listCustomers).mockResolvedValue(asPage([makeCustomer()]))
    vi.mocked(deleteCustomer).mockImplementation(async () => {
      vi.mocked(listCustomers).mockResolvedValue(asPage([]))
    })

    renderWithProviders(<CustomersBoard />)
    await screen.findByText("Elena Park")

    await user.click(screen.getByRole("button", { name: "Delete Elena Park" }))
    expect(await screen.findByText(/This cannot be undone/)).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Delete customer" }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(deleteCustomer).toHaveBeenCalledWith("cust-1")
    })
    expect(await screen.findByText("No customers yet")).toBeInTheDocument()
    expect(screen.queryByText("Elena Park")).not.toBeInTheDocument()
  })

  it("searches customers through the API", async () => {
    const elena = makeCustomer()
    const noah = makeCustomer({
      id: "cust-2",
      first_name: "Noah",
      last_name: "Diaz",
      email: "noah@orbit.example",
      company: "Orbitly",
    })
    vi.mocked(listCustomers).mockImplementation(async (params = {}) => {
      const query = params.query
      if (query?.toLowerCase() === "harbor") return asPage([elena])
      if (query) return asPage([])
      return asPage([elena, noah])
    })

    renderWithProviders(<CustomersBoard />)
    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
    expect(screen.getByText("Noah Diaz")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Search customers"), {
      target: { value: "Harbor" },
    })
    await flushSearchDebounce()

    await waitFor(() => {
      expect(listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ query: "Harbor" }),
      )
    })
    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Noah Diaz")).not.toBeInTheDocument()
    })
  })

  it("loads the next page of customers", async () => {
    const user = userEvent.setup()
    const first = makeCustomer()
    const second = makeCustomer({
      id: "cust-2",
      first_name: "Noah",
      last_name: "Diaz",
      email: "noah@orbit.example",
    })
    vi.mocked(listCustomers).mockImplementation(async (params = {}) => {
      if (params.page === 2) {
        return asPage([second], { page: 2, total: 2, hasNext: false })
      }
      return asPage([first], { page: 1, total: 2, hasNext: true })
    })

    renderWithProviders(<CustomersBoard />)
    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
    expect(screen.getByText("Showing 1–2 of 2 customers")).toBeInTheDocument()

    // The search effect always schedules setPage(1) 300ms after mount.
    // Wait it out so clicking Next is not overwritten by that timer.
    await flushSearchDebounce()
    expect(screen.getByText("Elena Park")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(await screen.findByText("Noah Diaz")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByText("Elena Park")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 20 }),
      )
    })
  })

  it("keeps customer workflows available for AGENT", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(makeAgentUser())
    vi.mocked(listCustomers).mockResolvedValue(asPage([makeCustomer()]))

    renderWithProviders(<CustomersBoard />)

    expect(
      await screen.findByRole("heading", { name: "Customers" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New customer" }),
    ).toBeInTheDocument()
    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
  })
})
