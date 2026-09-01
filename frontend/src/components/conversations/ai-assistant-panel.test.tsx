import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { AiAssistantPanel } from "@/components/conversations/ai-assistant-panel"
import { suggestConversationReply } from "@/services/conversation-ai"
import { makeConversation } from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/conversation-ai", () => ({
  suggestConversationReply: vi.fn(),
}))

describe("AiAssistantPanel", () => {
  it("shows a placeholder when no conversation is selected", () => {
    renderWithProviders(
      <AiAssistantPanel conversation={null} onUseSuggestion={vi.fn()} />,
    )

    expect(
      screen.getByText("AI suggestions appear when a conversation is selected."),
    ).toBeInTheDocument()
  })

  it("shows loading, then a grounded suggestion", async () => {
    const user = userEvent.setup()
    const pending = deferred<Awaited<ReturnType<typeof suggestConversationReply>>>()
    vi.mocked(suggestConversationReply).mockReturnValue(pending.promise)

    renderWithProviders(
      <AiAssistantPanel
        conversation={makeConversation()}
        onUseSuggestion={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Generate AI suggestion" }),
    )
    expect(screen.getByText("Generating suggestion…")).toBeInTheDocument()

    pending.resolve({
      conversationId: "conv-1",
      suggestedReply: "You can request a refund within 14 days.",
      sources: [
        {
          documentId: "doc-1",
          title: "Refund policy",
          source: "handbook",
          chunkId: "chunk-1",
          score: 0.9,
          distance: 0.1,
        },
      ],
      retrievedCount: 1,
      usedGeneration: true,
      customerMessageId: "msg-1",
    })

    expect(
      await screen.findByText("You can request a refund within 14 days."),
    ).toBeInTheDocument()
    expect(screen.getByText("Refund policy")).toBeInTheDocument()
    expect(suggestConversationReply).toHaveBeenCalledWith("conv-1", 5)
  })

  it("shows an error when suggestion generation fails", async () => {
    const user = userEvent.setup()
    vi.mocked(suggestConversationReply).mockRejectedValue(
      new Error("Suggestion unavailable"),
    )

    renderWithProviders(
      <AiAssistantPanel
        conversation={makeConversation()}
        onUseSuggestion={vi.fn()}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Generate AI suggestion" }),
    )

    expect(await screen.findByText("Suggestion unavailable")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Regenerate suggestion" }),
    ).toBeInTheDocument()
  })

  it("fills the reply when Use suggestion is clicked", async () => {
    const user = userEvent.setup()
    const onUseSuggestion = vi.fn()
    vi.mocked(suggestConversationReply).mockResolvedValue({
      conversationId: "conv-1",
      suggestedReply: "Happy to help with that refund.",
      sources: [],
      retrievedCount: 0,
      usedGeneration: false,
      customerMessageId: "msg-1",
    })

    renderWithProviders(
      <AiAssistantPanel
        conversation={makeConversation()}
        onUseSuggestion={onUseSuggestion}
      />,
    )

    await user.click(
      screen.getByRole("button", { name: "Generate AI suggestion" }),
    )
    await screen.findByText("Happy to help with that refund.")
    await user.click(screen.getByRole("button", { name: "Use suggestion" }))

    await waitFor(() => {
      expect(onUseSuggestion).toHaveBeenCalledWith(
        "Happy to help with that refund.",
      )
    })
  })
})
