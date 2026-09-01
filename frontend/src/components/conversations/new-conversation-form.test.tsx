import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import {
  emptyNewConversationValues,
  NewConversationForm,
  validateNewConversationValues,
} from "@/components/conversations/new-conversation-form"
import { renderWithProviders } from "@/test/test-utils"

describe("validateNewConversationValues", () => {
  it("requires customer name, email, subject, and initial message", () => {
    expect(validateNewConversationValues(emptyNewConversationValues())).toBe(
      "Customer name is required.",
    )
    expect(
      validateNewConversationValues({
        ...emptyNewConversationValues(),
        customer_name: "Elena Park",
      }),
    ).toBe("Customer email is required.")
    expect(
      validateNewConversationValues({
        ...emptyNewConversationValues(),
        customer_name: "Elena Park",
        customer_email: "not-an-email",
      }),
    ).toBe("Enter a valid customer email address.")
    expect(
      validateNewConversationValues({
        ...emptyNewConversationValues(),
        customer_name: "Elena Park",
        customer_email: "elena@acme.example",
      }),
    ).toBe("Subject is required.")
    expect(
      validateNewConversationValues({
        ...emptyNewConversationValues(),
        customer_name: "Elena Park",
        customer_email: "elena@acme.example",
        subject: "Refund request",
      }),
    ).toBe("Initial customer message is required.")
    expect(
      validateNewConversationValues({
        ...emptyNewConversationValues(),
        customer_name: "Elena Park",
        customer_email: "elena@acme.example",
        subject: "Refund request",
        initial_message: "Can I request a refund?",
      }),
    ).toBeNull()
  })
})

describe("NewConversationForm", () => {
  it("renders required fields and displays a validation error", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const onChange = vi.fn()

    renderWithProviders(
      <NewConversationForm
        values={emptyNewConversationValues()}
        onChange={onChange}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        error="Customer name is required."
      />,
    )

    expect(screen.getByLabelText("Customer name")).toBeRequired()
    expect(screen.getByLabelText("Customer email")).toBeRequired()
    expect(screen.getByLabelText("Subject")).toBeRequired()
    expect(screen.getByLabelText("Initial customer message")).toBeRequired()
    expect(screen.getByText("Customer name is required.")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Customer name"), "Elena")
    expect(onChange).toHaveBeenCalled()
  })
})
