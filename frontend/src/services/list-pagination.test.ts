import { beforeEach, describe, expect, it, vi } from "vitest"

import { api } from "@/services/api"
import { listCustomers } from "@/services/customers"
import { listConversations } from "@/services/conversations"
import { listTickets } from "@/services/tickets"

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
  },
}))

describe("paginated list services", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset()
  })

  it("maps customer list envelopes and query params", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        items: [{ id: "cust-1" }],
        page: 2,
        page_size: 20,
        total: 21,
        has_next: false,
      },
    })

    const page = await listCustomers({ query: "Harbor", page: 2, pageSize: 20 })
    expect(api.get).toHaveBeenCalledWith("/customers", {
      params: { q: "Harbor", page: 2, page_size: 20 },
    })
    expect(page).toEqual({
      items: [{ id: "cust-1" }],
      page: 2,
      pageSize: 20,
      total: 21,
      hasNext: false,
    })
  })

  it("requests ticket filters with pagination", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        items: [],
        page: 1,
        page_size: 20,
        total: 0,
        has_next: false,
      },
    })

    await listTickets({ status: "OPEN", page: 1, pageSize: 20 })
    expect(api.get).toHaveBeenCalledWith("/tickets", {
      params: {
        q: undefined,
        status: "OPEN",
        priority: undefined,
        assignee_id: undefined,
        unassigned: undefined,
        customer_id: undefined,
        page: 1,
        page_size: 20,
      },
    })
  })

  it("requests conversation pages", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        items: [],
        page: 1,
        page_size: 100,
        total: 0,
        has_next: false,
      },
    })

    await listConversations({ page: 1, pageSize: 100 })
    expect(api.get).toHaveBeenCalledWith("/conversations", {
      params: { page: 1, page_size: 100 },
    })
  })
})
