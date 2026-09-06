import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import { KnowledgeDocumentList } from "@/components/knowledge-base/knowledge-document-list"
import { makeKnowledgeDocument } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

describe("KnowledgeDocumentList", () => {
  it("shows a loading state", () => {
    renderWithProviders(
      <KnowledgeDocumentList
        documents={[]}
        isLoading
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText("Loading knowledge documents…")).toBeInTheDocument()
  })

  it("shows an empty state", () => {
    renderWithProviders(
      <KnowledgeDocumentList
        documents={[]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText("No knowledge documents yet")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Published documents in this workspace appear here. Ask an owner or admin to add one.",
      ),
    ).toBeInTheDocument()
  })

  it("tells managers they can create the first document", () => {
    renderWithProviders(
      <KnowledgeDocumentList
        documents={[]}
        canManage
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(
      screen.getByText("Create your first document to power future AI answers."),
    ).toBeInTheDocument()
  })

  it("shows an error with retry", async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()

    renderWithProviders(
      <KnowledgeDocumentList
        documents={[]}
        error="Unable to load knowledge documents."
        onRetry={onRetry}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(
      screen.getByText("Couldn’t load knowledge documents"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Unable to load knowledge documents."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(onRetry).toHaveBeenCalled()
  })

  it("renders API-backed documents", () => {
    renderWithProviders(
      <KnowledgeDocumentList
        documents={[makeKnowledgeDocument()]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Refund policy" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Customers may request a refund within 14 days of purchase."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /View/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Edit/ })).not.toBeInTheDocument()
  })
})
