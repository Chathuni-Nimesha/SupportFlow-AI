import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import { ReplyComposer } from "@/components/conversations/reply-composer"
import { renderWithProviders } from "@/test/test-utils"

describe("ReplyComposer", () => {
  it("disables send when the draft is empty", () => {
    renderWithProviders(
      <ReplyComposer
        draft="   "
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("sends the trimmed draft", async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)

    renderWithProviders(
      <ReplyComposer
        draft=" Thanks for waiting "
        onDraftChange={vi.fn()}
        onSend={onSend}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Send" }))

    expect(onSend).toHaveBeenCalledWith("Thanks for waiting")
  })

  it("shows a send error", () => {
    renderWithProviders(
      <ReplyComposer
        draft="Hello"
        onDraftChange={vi.fn()}
        onSend={vi.fn()}
        error="Unable to send message."
      />,
    )

    expect(screen.getByText("Unable to send message.")).toBeInTheDocument()
  })
})
