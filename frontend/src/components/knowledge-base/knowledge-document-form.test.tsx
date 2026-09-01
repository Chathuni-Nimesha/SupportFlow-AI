import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import { KnowledgeDocumentForm } from "@/components/knowledge-base/knowledge-document-form"
import { emptyKnowledgeFormValues } from "@/lib/knowledge-mappers"
import { renderWithProviders } from "@/test/test-utils"

describe("KnowledgeDocumentForm", () => {
  it("requires title and content", () => {
    renderWithProviders(
      <KnowledgeDocumentForm
        values={emptyKnowledgeFormValues()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="Create document"
      />,
    )

    expect(screen.getByLabelText("Title")).toBeRequired()
    expect(screen.getByLabelText("Content")).toBeRequired()
    expect(
      screen.getByRole("button", { name: "Create document" }),
    ).toBeInTheDocument()
  })

  it("displays a form error", () => {
    renderWithProviders(
      <KnowledgeDocumentForm
        values={emptyKnowledgeFormValues()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitLabel="Create document"
        error="Unable to create document."
      />,
    )

    expect(screen.getByText("Unable to create document.")).toBeInTheDocument()
  })

  it("submits filled values", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    renderWithProviders(
      <KnowledgeDocumentForm
        values={{
          ...emptyKnowledgeFormValues(),
          title: "Refund policy",
          content: "Refunds are issued within 5 business days.",
        }}
        onChange={vi.fn()}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        submitLabel="Create document"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Create document" }))
    expect(onSubmit).toHaveBeenCalled()
  })
})
