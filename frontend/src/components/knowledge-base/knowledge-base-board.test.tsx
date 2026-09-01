import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor, within } from "@testing-library/react"

import { KnowledgeBaseBoard } from "@/components/knowledge-base/knowledge-base-board"
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  ingestKnowledgeDocument,
  listKnowledgeDocuments,
  updateKnowledgeDocument,
} from "@/services/knowledge"
import { makeKnowledgeDocument } from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"
import type { KnowledgeIngestionResponse } from "@/types/knowledge"

vi.mock("@/services/knowledge", () => ({
  searchKnowledge: vi.fn(),
  listKnowledgeDocuments: vi.fn(),
  getKnowledgeDocument: vi.fn(),
  createKnowledgeDocument: vi.fn(),
  updateKnowledgeDocument: vi.fn(),
  deleteKnowledgeDocument: vi.fn(),
  ingestKnowledgeDocument: vi.fn(),
}))

function ingestResponse(
  document = makeKnowledgeDocument(),
): KnowledgeIngestionResponse {
  return {
    document,
    ingestion_status: document.ingestion_status,
    chunk_count: document.chunk_count,
    message: "Indexed",
  }
}

describe("KnowledgeBaseBoard", () => {
  beforeEach(() => {
    vi.mocked(listKnowledgeDocuments).mockReset()
    vi.mocked(getKnowledgeDocument).mockReset()
    vi.mocked(createKnowledgeDocument).mockReset()
    vi.mocked(updateKnowledgeDocument).mockReset()
    vi.mocked(deleteKnowledgeDocument).mockReset()
    vi.mocked(ingestKnowledgeDocument).mockReset()
  })

  it("renders the Knowledge Base board chrome", async () => {
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([])

    renderWithProviders(<KnowledgeBaseBoard />)

    expect(
      await screen.findByRole("heading", { name: "Knowledge Base" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "New document" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Semantic knowledge search")).toBeInTheDocument()
    expect(screen.getByText("Filter documents")).toBeInTheDocument()
  })

  it("shows a loading state while documents are fetched", async () => {
    const pending = deferred<ReturnType<typeof makeKnowledgeDocument>[]>()
    vi.mocked(listKnowledgeDocuments).mockReturnValue(pending.promise)

    renderWithProviders(<KnowledgeBaseBoard />)

    expect(
      await screen.findByText("Loading knowledge documents…"),
    ).toBeInTheDocument()

    pending.resolve([])
    expect(
      await screen.findByText("No knowledge documents yet"),
    ).toBeInTheDocument()
  })

  it("shows an empty state when there are no documents", async () => {
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([])

    renderWithProviders(<KnowledgeBaseBoard />)

    expect(
      await screen.findByText("No knowledge documents yet"),
    ).toBeInTheDocument()
  })

  it("shows a list error and retries", async () => {
    const user = userEvent.setup()
    vi.mocked(listKnowledgeDocuments)
      .mockRejectedValueOnce(new Error("Unable to load knowledge documents."))
      .mockResolvedValueOnce([makeKnowledgeDocument()])

    renderWithProviders(<KnowledgeBaseBoard />)

    expect(
      await screen.findByText("Couldn’t load knowledge documents"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("heading", { name: "Refund policy" }),
    ).toBeInTheDocument()
    expect(listKnowledgeDocuments).toHaveBeenCalledTimes(2)
  })

  it("creates a document and shows it in the list", async () => {
    const user = userEvent.setup()
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([])
    const created = makeKnowledgeDocument({
      id: "doc-created",
      title: "Shipping SLA",
      content: "Orders ship within two business days.",
      status: "Draft",
      tags: [],
    })
    vi.mocked(createKnowledgeDocument).mockResolvedValue(created)

    renderWithProviders(<KnowledgeBaseBoard />)
    await screen.findByText("No knowledge documents yet")

    await user.click(screen.getByRole("button", { name: "New document" }))
    expect(
      await screen.findByRole("heading", { name: "New document" }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("Title"), "Shipping SLA")
    await user.type(
      screen.getByLabelText("Content"),
      "Orders ship within two business days.",
    )
    await user.click(screen.getByRole("button", { name: "Create document" }))

    await waitFor(() => {
      expect(createKnowledgeDocument).toHaveBeenCalledWith({
        title: "Shipping SLA",
        content: "Orders ship within two business days.",
        source_type: "manual",
        source: null,
        status: "Draft",
        tags: [],
      })
    })
    expect(
      await screen.findByRole("heading", { name: "Shipping SLA" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "New document" }),
    ).not.toBeInTheDocument()
  })

  it("keeps the create sheet open and shows an error when create fails", async () => {
    const user = userEvent.setup()
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([])
    vi.mocked(createKnowledgeDocument).mockRejectedValue(
      new Error("Unable to create document."),
    )

    renderWithProviders(<KnowledgeBaseBoard />)
    await screen.findByRole("button", { name: "New document" })
    await user.click(screen.getByRole("button", { name: "New document" }))

    await user.type(screen.getByLabelText("Title"), "Shipping SLA")
    await user.type(screen.getByLabelText("Content"), "Ships in two days.")
    await user.click(screen.getByRole("button", { name: "Create document" }))

    expect(
      await screen.findByText("Unable to create document."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "New document" }),
    ).toBeInTheDocument()
  })

  it("opens document details from the list", async () => {
    const user = userEvent.setup()
    const document = makeKnowledgeDocument({ source: "handbook" })
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([document])
    const pending = deferred<ReturnType<typeof makeKnowledgeDocument>>()
    vi.mocked(getKnowledgeDocument).mockReturnValue(pending.promise)

    renderWithProviders(<KnowledgeBaseBoard />)
    await screen.findByRole("heading", { name: "Refund policy" })

    await user.click(screen.getByRole("button", { name: /View/ }))
    expect(await screen.findByText("Loading document…")).toBeInTheDocument()

    pending.resolve(document)
    await waitFor(() => {
      expect(getKnowledgeDocument).toHaveBeenCalledWith("doc-1")
    })

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("heading", { name: "Refund policy" })).toBeInTheDocument()
    expect(within(dialog).getByText("Published")).toBeInTheDocument()
    expect(within(dialog).getByText(/handbook/)).toBeInTheDocument()
    expect(
      within(dialog).getByText(
        "Customers may request a refund within 14 days of purchase.",
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByText("Indexed")).toBeInTheDocument()
    expect(within(dialog).getByText("1 chunk")).toBeInTheDocument()
  })

  it("populates the edit form and saves changes", async () => {
    const user = userEvent.setup()
    const document = makeKnowledgeDocument()
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([document])
    const updated = makeKnowledgeDocument({
      title: "Updated refund policy",
      content: document.content,
    })
    vi.mocked(updateKnowledgeDocument).mockResolvedValue(updated)

    renderWithProviders(<KnowledgeBaseBoard />)
    await screen.findByRole("button", { name: /Edit/ })

    await user.click(screen.getByRole("button", { name: /Edit/ }))

    expect(
      await screen.findByRole("heading", { name: "Edit document" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Title")).toHaveValue("Refund policy")
    expect(screen.getByLabelText("Content")).toHaveValue(
      "Customers may request a refund within 14 days of purchase.",
    )
    expect(screen.getByLabelText("Status")).toHaveValue("Published")
    expect(screen.getByLabelText("Tags")).toHaveValue("billing")

    await user.clear(screen.getByLabelText("Title"))
    await user.type(screen.getByLabelText("Title"), "Updated refund policy")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(updateKnowledgeDocument).toHaveBeenCalledWith("doc-1", {
        title: "Updated refund policy",
        content: "Customers may request a refund within 14 days of purchase.",
        source_type: "manual",
        source: null,
        status: "Published",
        tags: ["billing"],
      })
    })
    expect(
      await screen.findByRole("heading", { name: "Updated refund policy" }),
    ).toBeInTheDocument()
  })

  it("changes document status through the edit form", async () => {
    const user = userEvent.setup()
    const document = makeKnowledgeDocument({ status: "Draft" })
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([document])
    vi.mocked(updateKnowledgeDocument).mockResolvedValue(
      makeKnowledgeDocument({ status: "Published" }),
    )

    renderWithProviders(<KnowledgeBaseBoard />)
    await user.click(await screen.findByRole("button", { name: /Edit/ }))

    expect(await screen.findByLabelText("Status")).toHaveValue("Draft")
    await user.selectOptions(screen.getByLabelText("Status"), "Published")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(updateKnowledgeDocument).toHaveBeenCalledWith(
        "doc-1",
        expect.objectContaining({ status: "Published" }),
      )
    })
  })

  it("confirms deletion and removes the document from the list", async () => {
    const user = userEvent.setup()
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([
      makeKnowledgeDocument(),
    ])
    vi.mocked(deleteKnowledgeDocument).mockResolvedValue(undefined)

    renderWithProviders(<KnowledgeBaseBoard />)
    await screen.findByRole("heading", { name: "Refund policy" })

    await user.click(screen.getByRole("button", { name: /Delete/ }))
    expect(await screen.findByText(/This cannot be undone/)).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Delete document" }),
    ).toBeInTheDocument()

    const dialog = screen.getByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(deleteKnowledgeDocument).toHaveBeenCalledWith("doc-1")
    })
    expect(
      await screen.findByText("No knowledge documents yet"),
    ).toBeInTheDocument()
  })

  it("shows a delete error without removing the document", async () => {
    const user = userEvent.setup()
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([
      makeKnowledgeDocument(),
    ])
    vi.mocked(deleteKnowledgeDocument).mockRejectedValue(
      new Error("Unable to delete document."),
    )

    renderWithProviders(<KnowledgeBaseBoard />)
    await user.click(await screen.findByRole("button", { name: /Delete/ }))

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(
      await screen.findByText("Unable to delete document."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Delete document" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("No knowledge documents yet"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Refund policy", hidden: true }),
    ).toBeInTheDocument()
  })

  it("re-ingests a document from the detail panel", async () => {
    const user = userEvent.setup()
    const document = makeKnowledgeDocument({
      ingestion_status: "not_indexed",
      chunk_count: 0,
      ingested_at: null,
    })
    const indexed = makeKnowledgeDocument({
      ingestion_status: "indexed",
      chunk_count: 3,
    })
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([document])
    vi.mocked(getKnowledgeDocument).mockResolvedValue(document)
    const pending = deferred<KnowledgeIngestionResponse>()
    vi.mocked(ingestKnowledgeDocument).mockReturnValue(pending.promise)

    renderWithProviders(<KnowledgeBaseBoard />)
    await user.click(await screen.findByRole("button", { name: /View/ }))
    const dialog = await screen.findByRole("dialog")
    await within(dialog).findByRole("button", { name: "Re-ingest" })

    await user.click(within(dialog).getByRole("button", { name: "Re-ingest" }))
    expect(within(dialog).getByText("Re-ingesting…")).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: /Re-ingesting/ }),
    ).toBeDisabled()

    pending.resolve(ingestResponse(indexed))

    expect(await within(dialog).findByText("Indexed")).toBeInTheDocument()
    expect(within(dialog).getByText("3 chunks")).toBeInTheDocument()
    await waitFor(() => {
      expect(ingestKnowledgeDocument).toHaveBeenCalledWith("doc-1")
    })
  })

  it("shows an ingest error on the detail panel", async () => {
    const user = userEvent.setup()
    const document = makeKnowledgeDocument()
    vi.mocked(listKnowledgeDocuments).mockResolvedValue([document])
    vi.mocked(getKnowledgeDocument).mockResolvedValue(document)
    vi.mocked(ingestKnowledgeDocument).mockRejectedValue(
      new Error("Unable to re-ingest this document."),
    )

    renderWithProviders(<KnowledgeBaseBoard />)
    await user.click(await screen.findByRole("button", { name: /View/ }))
    const dialog = await screen.findByRole("dialog")
    await user.click(
      await within(dialog).findByRole("button", { name: "Re-ingest" }),
    )

    expect(
      await within(dialog).findByText("Unable to re-ingest this document."),
    ).toBeInTheDocument()
  })
})
