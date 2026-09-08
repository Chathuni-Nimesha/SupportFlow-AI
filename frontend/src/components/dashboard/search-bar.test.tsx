import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SearchBar } from "@/components/dashboard/search-bar"
import { renderWithProviders } from "@/test/test-utils"
import type { GlobalSearchResponse } from "@/types/search"

const navigateMock = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock("@/services/search", () => ({
  globalSearch: vi.fn(),
  countGlobalSearchHits: (result: GlobalSearchResponse) =>
    result.conversations.length +
    result.tickets.length +
    result.customers.length +
    result.knowledge.length,
}))

import { globalSearch } from "@/services/search"

const emptyResult: GlobalSearchResponse = {
  query: "zzznone",
  conversations: [],
  tickets: [],
  customers: [],
  knowledge: [],
}

const sampleResult: GlobalSearchResponse = {
  query: "refund",
  conversations: [
    {
      id: "conv-1",
      type: "conversation",
      title: "Refund request for recent order",
      subtitle: "Olivia Carter · Open",
      href: "/dashboard/conversations?conversation=conv-1",
    },
  ],
  tickets: [
    {
      id: "tkt-1",
      type: "ticket",
      title: "Prorated refund for unused seats",
      subtitle: "OPEN · HIGH",
      href: "/dashboard/tickets?ticket=tkt-1",
    },
  ],
  customers: [
    {
      id: "cust-1",
      type: "customer",
      title: "Olivia Carter",
      subtitle: "olivia@example.com",
      href: "/dashboard/customers?customer=cust-1",
    },
  ],
  knowledge: [
    {
      id: "kb-1",
      type: "knowledge",
      title: "Refund and Cancellation Policy",
      subtitle: "Published",
      href: "/dashboard/knowledge-base?document=kb-1",
    },
  ],
}

describe("SearchBar", () => {
  beforeEach(() => {
    navigateMock.mockReset()
    vi.mocked(globalSearch).mockReset()
  })

  it("is enabled and uses a Search placeholder", () => {
    renderWithProviders(<SearchBar />)
    const input = screen.getByRole("combobox", { name: /global search/i })
    expect(input).toBeEnabled()
    expect(input).toHaveAttribute("placeholder", "Search...")
  })

  it("debounces and shows grouped results", async () => {
    const user = userEvent.setup()
    vi.mocked(globalSearch).mockResolvedValue(sampleResult)
    renderWithProviders(<SearchBar />)

    await user.type(
      screen.getByRole("combobox", { name: /global search/i }),
      "refund",
    )

    await waitFor(() => {
      expect(globalSearch).toHaveBeenCalledWith({ query: "refund" })
    })

    expect(await screen.findByText("Conversations")).toBeInTheDocument()
    expect(screen.getByText("Tickets")).toBeInTheDocument()
    expect(screen.getByText("Customers")).toBeInTheDocument()
    expect(screen.getByText("Knowledge")).toBeInTheDocument()
    expect(
      screen.getByRole("option", { name: /Refund request for recent order/i }),
    ).toBeInTheDocument()
  })

  it("shows no results found", async () => {
    const user = userEvent.setup()
    vi.mocked(globalSearch).mockResolvedValue(emptyResult)
    renderWithProviders(<SearchBar />)

    await user.type(
      screen.getByRole("combobox", { name: /global search/i }),
      "zzznone",
    )

    expect(await screen.findByText("No results found")).toBeInTheDocument()
  })

  it("navigates when a result is clicked", async () => {
    const user = userEvent.setup()
    vi.mocked(globalSearch).mockResolvedValue(sampleResult)
    renderWithProviders(<SearchBar />)

    await user.type(
      screen.getByRole("combobox", { name: /global search/i }),
      "refund",
    )

    const option = await screen.findByRole("option", {
      name: /Prorated refund for unused seats/i,
    })
    await user.click(option)

    expect(navigateMock).toHaveBeenCalledWith("/dashboard/tickets?ticket=tkt-1")
  })

  it("does not search for queries shorter than two characters", async () => {
    const user = userEvent.setup()
    renderWithProviders(<SearchBar />)

    await user.type(
      screen.getByRole("combobox", { name: /global search/i }),
      "a",
    )

    expect(
      await screen.findByText(/at least 2 characters/i),
    ).toBeInTheDocument()
    expect(globalSearch).not.toHaveBeenCalled()
  })
})
