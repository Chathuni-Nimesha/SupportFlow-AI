import { describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen } from "@testing-library/react"

import {
  emptyNewConversationValues,
  NewConversationForm,
  toConversationCreatePayload,
  validateNewConversationValues,
} from "@/components/conversations/new-conversation-form"
import { makeCustomer } from "@/test/fixtures"
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

describe("toConversationCreatePayload", () => {
  it("omits customer_id unless an existing customer is selected", () => {
    expect(
      toConversationCreatePayload({
        ...emptyNewConversationValues(),
        customer_name: "Elena Park",
        customer_email: "elena@acme.example",
        subject: "Refund request",
        initial_message: "Can I request a refund?",
      }),
    ).toEqual({
      customer_name: "Elena Park",
      customer_email: "elena@acme.example",
      subject: "Refund request",
      channel: "Chat",
      initial_message: "Can I request a refund?",
    })
    expect(
      toConversationCreatePayload({
        ...emptyNewConversationValues(),
        customer_id: "cust-1",
        customer_name: "Elena Park",
        customer_email: "elena@acme.example",
        subject: "Refund request",
        initial_message: "Can I request a refund?",
      }),
    ).toEqual({
      customer_name: "Elena Park",
      customer_email: "elena@acme.example",
      subject: "Refund request",
      channel: "Chat",
      initial_message: "Can I request a refund?",
      customer_id: "cust-1",
    })
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
    expect(screen.getByLabelText("Channel")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Channel is a label on this thread. Email and Slack are not connected as inboxes.",
      ),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("Customer name"), "Elena")
    expect(onChange).toHaveBeenCalled()
  })

  it("fills name and email when an existing customer is selected", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const customer = makeCustomer()

    renderWithProviders(
      <NewConversationForm
        values={emptyNewConversationValues()}
        onChange={onChange}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        customers={[customer]}
      />,
    )

    await user.selectOptions(
      screen.getByLabelText("Existing customer (optional)"),
      customer.id,
    )
    expect(onChange).toHaveBeenCalledWith({
      ...emptyNewConversationValues(),
      customer_id: customer.id,
      customer_name: "Elena Park",
      customer_email: customer.email,
    })
  })
})
