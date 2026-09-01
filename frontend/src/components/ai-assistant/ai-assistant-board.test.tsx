import { describe, expect, it, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"

import { AiAssistantBoard } from "@/components/ai-assistant/ai-assistant-board"
import { generateAiAnswer } from "@/services/ai"
import {
  sampleGroundedAnswer,
  sampleNoKnowledgeAnswer,
} from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"
import userEvent from "@testing-library/user-event"

vi.mock("@/services/ai", () => ({
  generateAiAnswer: vi.fn(),
  mapAiAnswer: vi.fn(),
}))

describe("AiAssistantBoard", () => {
  it("shows the initial empty state", () => {
    renderWithProviders(<AiAssistantBoard />)

    expect(
      screen.getByRole("heading", { name: "AI Assistant" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Ready when you are")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled()
  })

  it("does not call the API when the question is empty", async () => {
    const user = userEvent.setup()
    renderWithProviders(<AiAssistantBoard />)

    await user.click(screen.getByRole("button", { name: "Ask" }))
    expect(generateAiAnswer).not.toHaveBeenCalled()
  })

  it("shows a loading state while generating", async () => {
    const user = userEvent.setup()
    const pending = deferred<typeof sampleGroundedAnswer>()
    vi.mocked(generateAiAnswer).mockReturnValue(pending.promise)

    renderWithProviders(<AiAssistantBoard />)
    await user.type(
      screen.getByLabelText("Question"),
      "What is the refund policy?",
    )
    await user.click(screen.getByRole("button", { name: "Ask" }))

    expect(
      screen.getByText("Retrieving published knowledge and generating an answer…"),
    ).toBeInTheDocument()

    pending.resolve(sampleGroundedAnswer)
    expect(
      await screen.findByText(sampleGroundedAnswer.answer),
    ).toBeInTheDocument()
  })

  it("renders a grounded answer and sources", async () => {
    const user = userEvent.setup()
    vi.mocked(generateAiAnswer).mockResolvedValue(sampleGroundedAnswer)

    renderWithProviders(<AiAssistantBoard />)
    await user.type(
      screen.getByLabelText("Question"),
      "What is the refund policy?",
    )
    await user.click(screen.getByRole("button", { name: "Ask" }))

    expect(
      await screen.findByText(sampleGroundedAnswer.answer),
    ).toBeInTheDocument()
    expect(screen.getByText("Refund policy")).toBeInTheDocument()
    expect(screen.getByText("91% match")).toBeInTheDocument()
    expect(screen.getByText("Retrieved: 1")).toBeInTheDocument()
    expect(screen.getByText("Gemini generation used")).toBeInTheDocument()
    await waitFor(() => {
      expect(generateAiAnswer).toHaveBeenCalledWith(
        "What is the refund policy?",
        5,
      )
    })
  })

  it("shows the no-knowledge state", async () => {
    const user = userEvent.setup()
    vi.mocked(generateAiAnswer).mockResolvedValue(sampleNoKnowledgeAnswer)

    renderWithProviders(<AiAssistantBoard />)
    await user.type(screen.getByLabelText("Question"), "Unrelated topic")
    await user.click(screen.getByRole("button", { name: "Ask" }))

    expect(await screen.findByText("Not enough knowledge")).toBeInTheDocument()
    expect(screen.getByText("Retrieved: 0")).toBeInTheDocument()
    expect(screen.getByText("No Gemini generation")).toBeInTheDocument()
    expect(screen.queryByText("Answer")).not.toBeInTheDocument()
  })

  it("shows an API error and retries", async () => {
    const user = userEvent.setup()
    vi.mocked(generateAiAnswer)
      .mockRejectedValueOnce(new Error("AI service unavailable"))
      .mockResolvedValueOnce(sampleGroundedAnswer)

    renderWithProviders(<AiAssistantBoard />)
    await user.type(
      screen.getByLabelText("Question"),
      "What is the refund policy?",
    )
    await user.click(screen.getByRole("button", { name: "Ask" }))

    expect(await screen.findByText("Unable to answer")).toBeInTheDocument()
    expect(screen.getByText("AI service unavailable")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(
      await screen.findByText(sampleGroundedAnswer.answer),
    ).toBeInTheDocument()
    expect(generateAiAnswer).toHaveBeenCalledTimes(2)
  })
})
