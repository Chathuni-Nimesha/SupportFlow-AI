import { describe, expect, it } from "vitest"

import {
  countByStatus,
  countPresentChannels,
} from "@/components/analytics/conversation-counts"
import { makeConversationApi } from "@/test/fixtures"

describe("conversation-counts", () => {
  it("counts conversations by status", () => {
    const counts = countByStatus([
      makeConversationApi({ id: "1", status: "Open" }),
      makeConversationApi({ id: "2", status: "Open" }),
      makeConversationApi({ id: "3", status: "Waiting" }),
      makeConversationApi({ id: "4", status: "Closed" }),
      makeConversationApi({ id: "5", status: "AI Resolved" }),
    ])

    expect(counts).toEqual({
      total: 5,
      Open: 2,
      Waiting: 1,
      Closed: 1,
      "AI Resolved": 1,
    })
  })

  it("counts only channels that are present", () => {
    const channels = countPresentChannels([
      makeConversationApi({ id: "1", channel: "Email" }),
      makeConversationApi({ id: "2", channel: "Email" }),
      makeConversationApi({ id: "3", channel: "Chat" }),
    ])

    expect(channels).toEqual([
      { channel: "Chat", count: 1 },
      { channel: "Email", count: 2 },
    ])
  })
})
