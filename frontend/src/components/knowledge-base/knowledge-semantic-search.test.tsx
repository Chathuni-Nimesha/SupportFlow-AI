import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { KnowledgeSemanticSearch } from "@/components/knowledge-base/knowledge-semantic-search"
import { searchKnowledge } from "@/services/knowledge"
import { makeSearchResponse } from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/knowledge", () => ({
  searchKnowledge: vi.fn(),
  listKnowledgeDocuments: vi.fn(),
  getKnowledgeDocument: vi.fn(),
  createKnowledgeDocument: vi.fn(),
  updateKnowledgeDocument: vi.fn(),
  deleteKnowledgeDocument: vi.fn(),
  ingestKnowledgeDocument: vi.fn(),
}))

describe("KnowledgeSemanticSearch", () => {
  it("does not search until the user submits a query", () => {
    renderWithProviders(<KnowledgeSemanticSearch />)

    expect(
      screen.getByText("Semantic knowledge search"),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Search" })).toBeDisabled()
    expect(searchKnowledge).not.toHaveBeenCalled()
  })

  it("shows a loading state while searching", async () => {
    const user = userEvent.setup()
    const pending = deferred<ReturnType<typeof makeSearchResponse>>()
    vi.mocked(searchKnowledge).mockReturnValue(pending.promise)

    renderWithProviders(<KnowledgeSemanticSearch />)
    await user.type(
      screen.getByLabelText("Semantic knowledge search"),
      "refund policy",
    )
    await user.click(screen.getByRole("button", { name: "Search" }))

    expect(screen.getByText("Searching published knowledge…")).toBeInTheDocument()
    pending.resolve(makeSearchResponse())
    expect(await screen.findByText("Refund policy")).toBeInTheDocument()
  })

  it("renders search hits from the API", async () => {
    const user = userEvent.setup()
    vi.mocked(searchKnowledge).mockResolvedValue(
      makeSearchResponse({ query: "refund policy" }),
    )

    renderWithProviders(<KnowledgeSemanticSearch />)
    await user.type(
      screen.getByLabelText("Semantic knowledge search"),
      "refund policy",
    )
    await user.click(screen.getByRole("button", { name: "Search" }))

    expect(await screen.findByText("Refund policy")).toBeInTheDocument()
    expect(screen.getByText("88% match")).toBeInTheDocument()
    expect(screen.getByText("Chunk 1 of 1")).toBeInTheDocument()
    expect(
      screen.getByText("Customers may request a refund within 14 days of purchase."),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(searchKnowledge).toHaveBeenCalledWith({
        query: "refund policy",
        top_k: 5,
      })
    })
  })

  it("shows an empty state when no chunks match", async () => {
    const user = userEvent.setup()
    vi.mocked(searchKnowledge).mockResolvedValue(
      makeSearchResponse({ query: "unrelated", count: 0, results: [] }),
    )

    renderWithProviders(<KnowledgeSemanticSearch />)
    await user.type(
      screen.getByLabelText("Semantic knowledge search"),
      "unrelated",
    )
    await user.click(screen.getByRole("button", { name: "Search" }))

    expect(
      await screen.findByText("No matching knowledge found."),
    ).toBeInTheDocument()
  })

  it("shows an error and retries the last query", async () => {
    const user = userEvent.setup()
    vi.mocked(searchKnowledge)
      .mockRejectedValueOnce(new Error("Knowledge search unavailable"))
      .mockResolvedValueOnce(makeSearchResponse())

    renderWithProviders(<KnowledgeSemanticSearch />)
    await user.type(
      screen.getByLabelText("Semantic knowledge search"),
      "refund policy",
    )
    await user.click(screen.getByRole("button", { name: "Search" }))

    expect(await screen.findByText("Knowledge search failed")).toBeInTheDocument()
    expect(screen.getByText("Knowledge search unavailable")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("Refund policy")).toBeInTheDocument()
    expect(searchKnowledge).toHaveBeenCalledTimes(2)
  })
})
