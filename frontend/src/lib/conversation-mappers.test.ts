import { describe, expect, it } from "vitest"

import { mapConversationFromApi } from "@/lib/conversation-mappers"
import { makeConversationApi } from "@/test/fixtures"

describe("conversation mappers", () => {
  it("keeps an optional customer_id on the inbox view-model", () => {
    expect(mapConversationFromApi(makeConversationApi()).customerId).toBeNull()
    expect(
      mapConversationFromApi(
        makeConversationApi({ customer_id: "cust-1" }),
      ).customerId,
    ).toBe("cust-1")
  })

  it("keeps an optional assigned agent on the inbox view-model", () => {
    expect(mapConversationFromApi(makeConversationApi()).assignedAgentId).toBeNull()
    expect(
      mapConversationFromApi(
        makeConversationApi({ assigned_agent_id: "member-1" }),
      ).assignedAgentId,
    ).toBe("member-1")
  })
})
