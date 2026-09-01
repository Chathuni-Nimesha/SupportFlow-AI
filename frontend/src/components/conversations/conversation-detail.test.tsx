import { describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"

import { ConversationDetail } from "@/components/conversations/conversation-detail"
import { makeConversation, makeUiMessage } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

describe("ConversationDetail", () => {
  it("asks the user to select a conversation when none is active", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={null}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.getByText("Select a conversation")).toBeInTheDocument()
    expect(
      screen.getByText("Choose a thread from the list to read messages and reply."),
    ).toBeInTheDocument()
  })

  it("renders conversation details and messages", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation({
          messages: [makeUiMessage()],
        })}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.getByRole("heading", { name: "Elena Park" })).toBeInTheDocument()
    expect(screen.getByText("Can I request a refund?")).toBeInTheDocument()
    expect(screen.getByLabelText("Reply message")).toBeInTheDocument()
  })

  it("shows a messages loading state", () => {
    renderWithProviders(
      <ConversationDetail
        conversation={makeConversation()}
        draft=""
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        isMessagesLoading
      />,
    )

    expect(screen.getByText("Loading messages…")).toBeInTheDocument()
  })
})
