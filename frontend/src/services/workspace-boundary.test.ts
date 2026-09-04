import { beforeEach, describe, expect, it, vi } from "vitest"

import { createCustomer } from "@/services/customers"
import { createConversation } from "@/services/conversations"
import { createKnowledgeDocument } from "@/services/knowledge"
import { createTeamMember } from "@/services/team"
import { createTicket } from "@/services/tickets"
import { selectWorkspace, updateWorkspace } from "@/services/workspaces"

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { api } from "@/services/api"

describe("client requests do not send workspace_id as authorization", () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset()
    vi.mocked(api.patch).mockReset()
    vi.mocked(api.post).mockResolvedValue({ data: {} })
    vi.mocked(api.patch).mockResolvedValue({ data: {} })
  })

  it("omits workspace_id from customer, ticket, conversation, team, and knowledge creates", async () => {
    await createCustomer({
      first_name: "Elena",
      last_name: "Park",
      email: "elena@acme.example",
    })
    await createTicket({
      customer_id: "cust-1",
      title: "Refund",
      description: "Need a refund",
    })
    await createConversation({
      customer_name: "Elena Park",
      customer_email: "elena@acme.example",
      subject: "Refund request",
      channel: "Email",
    })
    await createTeamMember({
      first_name: "Sam",
      last_name: "Agent",
      email: "sam@acme.example",
    })
    await createKnowledgeDocument({
      title: "Refund policy",
      content: "Refunds are available within 30 days.",
    })

    for (const call of vi.mocked(api.post).mock.calls) {
      const payload = call[1] as Record<string, unknown>
      expect(payload).not.toHaveProperty("workspace_id")
    }
  })

  it("updates a workspace by path id and name only", async () => {
    await updateWorkspace("workspace-1", { name: "Acme Support West" })

    expect(api.patch).toHaveBeenCalledWith("/workspaces/workspace-1", {
      name: "Acme Support West",
    })
    const payload = vi.mocked(api.patch).mock.calls[0][1] as Record<
      string,
      unknown
    >
    expect(payload).not.toHaveProperty("workspace_id")
  })

  it("selects a workspace by path id without a workspace_id body", async () => {
    await selectWorkspace("workspace-b")

    expect(api.post).toHaveBeenCalledWith("/workspaces/workspace-b/select")
    const payload = vi.mocked(api.post).mock.calls[0][1]
    expect(payload).toBeUndefined()
  })
})
