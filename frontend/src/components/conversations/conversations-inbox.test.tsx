import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import type { UserEvent } from "@testing-library/user-event"
import { screen, waitFor, within } from "@testing-library/react"

import { ConversationsInbox } from "@/components/conversations/conversations-inbox"
import {
  createConversation,
  getConversation,
  listConversationMessages,
  listConversations,
  updateConversation,
} from "@/services/conversations"
import { listCustomers } from "@/services/customers"
import { createTicket, listTickets } from "@/services/tickets"
import { listTeamMembers } from "@/services/team"
import { makeAgentUser, makeConversationApi, makeCustomer, makeMessageApi,
  makeTicket,
  asPage,
} from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"
import type { ConversationStatus } from "@/types/conversations"
import { fetchCurrentUser } from "@/services/auth"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

vi.mock("@/services/conversations", () => ({
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  listConversationMessages: vi.fn(),
  createConversation: vi.fn(),
  updateConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
}))

vi.mock("@/services/conversation-ai", () => ({
  suggestConversationReply: vi.fn(),
}))

vi.mock("@/services/customers", () => ({
  listCustomers: vi.fn(),
}))

vi.mock("@/services/tickets", () => ({
  listTickets: vi.fn(),
  createTicket: vi.fn(),
  getTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
}))

vi.mock("@/services/team", () => ({
  listTeamMembers: vi.fn(),
}))

async function fillNewConversationForm(user: UserEvent) {
  const dialog = await screen.findByRole("dialog")
  const fill = async (label: string, value: string) => {
    const field = within(dialog).getByLabelText(label)
    await user.click(field)
    await user.paste(value)
  }
  await fill("Customer name", "Elena Park")
  await fill("Customer email", "elena@acme.example")
  await fill("Subject", "Refund request")
  await fill("Initial customer message", "Can I request a refund?")
}

async function openConversationDetail(user: UserEvent, name = "Elena Park") {
  await user.click(await screen.findByText(name))
}

describe("ConversationsInbox", () => {
  beforeEach(() => {
    vi.mocked(listCustomers).mockReset()
    vi.mocked(listCustomers).mockResolvedValue(asPage([]))
    vi.mocked(listTickets).mockReset()
    vi.mocked(listTickets).mockResolvedValue(asPage([]))
    vi.mocked(createTicket).mockReset()
    vi.mocked(listTeamMembers).mockReset()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([]))
  })
  it("shows a loading state while conversations are fetched", async () => {
    const pending = deferred<ReturnType<typeof asPage<ReturnType<typeof makeConversationApi>>>>()
    vi.mocked(listConversations).mockReturnValue(pending.promise)

    renderWithProviders(<ConversationsInbox />)

    expect(
      await screen.findByText("Loading conversations…"),
    ).toBeInTheDocument()

    pending.resolve(asPage([]))
    await waitFor(() => {
      expect(
        screen.queryByText("Loading conversations…"),
      ).not.toBeInTheDocument()
    })
  })

  it("shows an empty state when the API returns no conversations", async () => {
    vi.mocked(listConversations).mockResolvedValue(asPage([]))

    renderWithProviders(<ConversationsInbox />)

    expect(
      await screen.findByText("No conversations found"),
    ).toBeInTheDocument()
    expect(screen.getByText("Select a conversation")).toBeInTheDocument()
  })

  it("shows an error when the list API fails", async () => {
    vi.mocked(listConversations).mockRejectedValue(
      new Error("Conversations unavailable"),
    )

    renderWithProviders(<ConversationsInbox />)

    expect(
      await screen.findByText("Couldn’t load conversations"),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText("Conversations unavailable").length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("renders API-backed conversations and their detail", async () => {
    const user = userEvent.setup()
    const conversation = makeConversationApi()
    vi.mocked(listConversations).mockResolvedValue(asPage([conversation]))
    vi.mocked(getConversation).mockResolvedValue(conversation)
    vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])

    renderWithProviders(<ConversationsInbox />)

    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
    expect(
      screen.getAllByText("Can I request a refund?").length,
    ).toBeGreaterThan(0)
    await user.click(screen.getByText("Elena Park"))
    expect(
      await screen.findByText(/elena@acme.example/),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(getConversation).toHaveBeenCalledWith("conv-1")
      expect(listConversationMessages).toHaveBeenCalledWith("conv-1")
    })
  })

  it("loads another conversation when a list item is selected", async () => {
    const user = userEvent.setup()
    const first = makeConversationApi()
    const second = makeConversationApi({
      id: "conv-2",
      customer_name: "Noah Diaz",
      customer_email: "noah@acme.example",
      last_message: "Shipping is delayed",
      subject: "Shipping delay",
    })
    vi.mocked(listConversations).mockResolvedValue(asPage([first, second]))
    vi.mocked(getConversation).mockImplementation(async (id) =>
      id === "conv-2" ? second : first,
    )
    vi.mocked(listConversationMessages).mockImplementation(async (id) => [
      makeMessageApi({
        id: `msg-${id}`,
        conversation_id: id,
        content:
          id === "conv-2" ? "Shipping is delayed" : "Can I request a refund?",
      }),
    ])

    renderWithProviders(<ConversationsInbox />)
    expect(await screen.findByText("Noah Diaz")).toBeInTheDocument()

    await user.click(screen.getByText("Noah Diaz"))

    await waitFor(() => {
      expect(getConversation).toHaveBeenCalledWith("conv-2")
    })
    expect(
      await screen.findByRole("heading", { name: "Noah Diaz" }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText("Shipping is delayed").length,
    ).toBeGreaterThan(0)
  })

  it("opens the new conversation sheet with the actual form fields", async () => {
    const user = userEvent.setup()
    vi.mocked(listConversations).mockResolvedValue(asPage([]))

    renderWithProviders(<ConversationsInbox />)
    await screen.findByText("No conversations found")

    await user.click(screen.getByRole("button", { name: /New/ }))

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByRole("heading", { name: "New conversation" }),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Customer name")).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Customer email")).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Subject")).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Channel")).toHaveValue("Chat")
    expect(
      within(dialog).getByLabelText("Initial customer message"),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "Create conversation" }),
    ).toBeInTheDocument()
  })

  it("creates a conversation, closes the sheet, and selects the new thread", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const created = makeConversationApi({
      id: "conv-created",
      channel: "Chat",
      last_message: "Can I request a refund?",
    })
    vi.mocked(listConversations).mockResolvedValue(asPage([]))
    vi.mocked(createConversation).mockResolvedValue(created)
    vi.mocked(getConversation).mockResolvedValue(created)
    vi.mocked(listConversationMessages).mockResolvedValue([
      makeMessageApi({
        conversation_id: "conv-created",
        content: "Can I request a refund?",
      }),
    ])

    renderWithProviders(<ConversationsInbox />)
    await screen.findByRole("button", { name: /New/ })
    await user.click(screen.getByRole("button", { name: /New/ }))
    await fillNewConversationForm(user)
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create conversation",
      }),
    )

    await waitFor(() => {
      expect(createConversation).toHaveBeenCalledWith({
        customer_name: "Elena Park",
        customer_email: "elena@acme.example",
        subject: "Refund request",
        channel: "Chat",
        initial_message: "Can I request a refund?",
      })
    })
    expect(
      screen.queryByRole("heading", { name: "New conversation" }),
    ).not.toBeInTheDocument()
    expect((await screen.findAllByText("Elena Park")).length).toBeGreaterThan(0)
    await waitFor(() => {
      expect(getConversation).toHaveBeenCalledWith("conv-created")
    })
  })

  it("shows a create error and keeps the sheet open", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    vi.mocked(listConversations).mockResolvedValue(asPage([]))
    vi.mocked(createConversation).mockRejectedValue(
      new Error("Unable to create conversation."),
    )

    renderWithProviders(<ConversationsInbox />)
    await user.click(await screen.findByRole("button", { name: /New/ }))
    await fillNewConversationForm(user)
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create conversation",
      }),
    )

    expect(
      await screen.findByText("Unable to create conversation."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "New conversation" }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create conversation",
      }),
    ).toBeEnabled()
  })

  it("disables submit and shows Creating… while the create request is in flight", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    const pending = deferred<ReturnType<typeof makeConversationApi>>()
    vi.mocked(listConversations).mockResolvedValue(asPage([]))
    vi.mocked(createConversation).mockReturnValue(pending.promise)

    renderWithProviders(<ConversationsInbox />)
    await user.click(await screen.findByRole("button", { name: /New/ }))
    await fillNewConversationForm(user)
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Create conversation",
      }),
    )

    const submit = await screen.findByRole("button", { name: /Creating/ })
    expect(submit).toBeDisabled()
    expect(
      within(screen.getByRole("dialog")).getByLabelText("Customer name"),
    ).toBeDisabled()

    const created = makeConversationApi({ id: "conv-created" })
    vi.mocked(getConversation).mockResolvedValue(created)
    vi.mocked(listConversationMessages).mockResolvedValue([
      makeMessageApi({ conversation_id: "conv-created" }),
    ])
    pending.resolve(created)
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: "New conversation" }),
      ).not.toBeInTheDocument()
    })
  })

  it("shows the current status after a conversation is opened", async () => {
    const user = userEvent.setup()
    const conversation = makeConversationApi({ status: "Open" })
    vi.mocked(listConversations).mockResolvedValue(asPage([conversation]))
    vi.mocked(getConversation).mockResolvedValue(conversation)
    vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])

    renderWithProviders(<ConversationsInbox />)
    await openConversationDetail(user)

    expect(await screen.findByLabelText("Conversation status")).toHaveValue(
      "Open",
    )
  })

  it.each(["Waiting", "Closed", "AI Resolved"] as const)(
    "updates conversation status to %s",
    async (status: ConversationStatus) => {
      const user = userEvent.setup()
      const conversation = makeConversationApi({ status: "Open" })
      const updated = makeConversationApi({ status })
      vi.mocked(listConversations).mockResolvedValue(asPage([conversation]))
      vi.mocked(getConversation).mockResolvedValue(conversation)
      vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])
      vi.mocked(updateConversation).mockResolvedValue(updated)

      renderWithProviders(<ConversationsInbox />)
      await openConversationDetail(user)

      const control = await screen.findByLabelText("Conversation status")
      await user.selectOptions(control, status)

      await waitFor(() => {
        expect(updateConversation).toHaveBeenCalledWith("conv-1", { status })
      })
      expect(await screen.findByLabelText("Conversation status")).toHaveValue(
        status,
      )
    },
  )

  it("shows a status update error in the existing reply error area", async () => {
    const user = userEvent.setup()
    const conversation = makeConversationApi()
    vi.mocked(listConversations).mockResolvedValue(asPage([conversation]))
    vi.mocked(getConversation).mockResolvedValue(conversation)
    vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])
    vi.mocked(updateConversation).mockRejectedValue(
      new Error("Unable to update conversation status."),
    )

    renderWithProviders(<ConversationsInbox />)
    await openConversationDetail(user)

    await user.selectOptions(
      await screen.findByLabelText("Conversation status"),
      "Closed",
    )

    expect(
      await screen.findByText("Unable to update conversation status."),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Conversation status")).toHaveValue("Open")
  })

  it("disables the status control while an update is in flight", async () => {
    const user = userEvent.setup()
    const conversation = makeConversationApi()
    const pending = deferred<ReturnType<typeof makeConversationApi>>()
    vi.mocked(listConversations).mockResolvedValue(asPage([conversation]))
    vi.mocked(getConversation).mockResolvedValue(conversation)
    vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])
    vi.mocked(updateConversation).mockReturnValue(pending.promise)

    renderWithProviders(<ConversationsInbox />)
    await openConversationDetail(user)

    await user.selectOptions(
      await screen.findByLabelText("Conversation status"),
      "Waiting",
    )

    expect(await screen.findByLabelText("Conversation status")).toBeDisabled()

    pending.resolve(makeConversationApi({ status: "Waiting" }))
    await waitFor(() => {
      expect(screen.getByLabelText("Conversation status")).toBeEnabled()
      expect(screen.getByLabelText("Conversation status")).toHaveValue("Waiting")
    })
  })

  it("shows a messages error when conversation detail fails to load", async () => {
    const user = userEvent.setup()
    vi.mocked(listConversations).mockResolvedValue(asPage([makeConversationApi()]))
    vi.mocked(getConversation).mockRejectedValue(
      new Error("Unable to load conversation messages."),
    )
    vi.mocked(listConversationMessages).mockRejectedValue(
      new Error("Unable to load conversation messages."),
    )

    renderWithProviders(<ConversationsInbox />)
    await openConversationDetail(user)

    expect(await screen.findByText("Couldn’t load messages")).toBeInTheDocument()
    expect(
      screen.getByText("Unable to load conversation messages."),
    ).toBeInTheDocument()
  })

  it("shows a loading state while conversation messages are fetched", async () => {
    const user = userEvent.setup()
    const conversation = makeConversationApi()
    const pendingDetail = deferred<ReturnType<typeof makeConversationApi>>()
    const pendingMessages = deferred<ReturnType<typeof makeMessageApi>[]>()
    vi.mocked(listConversations).mockResolvedValue(asPage([conversation]))
    vi.mocked(getConversation).mockReturnValue(pendingDetail.promise)
    vi.mocked(listConversationMessages).mockReturnValue(pendingMessages.promise)

    renderWithProviders(<ConversationsInbox />)
    await openConversationDetail(user)

    expect(await screen.findByText("Loading messages…")).toBeInTheDocument()

    pendingDetail.resolve(conversation)
    pendingMessages.resolve([makeMessageApi()])

    await waitFor(() => {
      expect(screen.queryByText("Loading messages…")).not.toBeInTheDocument()
    })
    expect(
      screen.getAllByText("Can I request a refund?").length,
    ).toBeGreaterThan(0)
  })

  it("keeps conversation workflows available for AGENT", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(makeAgentUser())
    vi.mocked(listConversations).mockResolvedValue(asPage([makeConversationApi()]))
    vi.mocked(getConversation).mockResolvedValue(makeConversationApi())
    vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])

    renderWithProviders(<ConversationsInbox />)

    expect(await screen.findByText("Elena Park")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /New/ })).toBeInTheDocument()
  })

  it("shows linked tickets for the active conversation", async () => {
    const conversation = makeConversationApi()
    vi.mocked(listConversations).mockResolvedValue(asPage([conversation]))
    vi.mocked(getConversation).mockResolvedValue(conversation)
    vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])
    vi.mocked(listTickets).mockResolvedValue(
      asPage([makeTicket({ title: "Refund not received" })]),
    )

    renderWithProviders(<ConversationsInbox />)

    expect(await screen.findByText("Linked tickets")).toBeInTheDocument()
    expect(await screen.findByText("Refund not received")).toBeInTheDocument()
    await waitFor(() => {
      expect(listTickets).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "conv-1" }),
      )
    })
  })

  it("creates a ticket from a conversation without auto-duplicating", async () => {
    const user = userEvent.setup()
    const conversation = makeConversationApi({ customer_id: "cust-1" })
    vi.mocked(listConversations).mockResolvedValue(asPage([conversation]))
    vi.mocked(getConversation).mockResolvedValue(conversation)
    vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])
    vi.mocked(listCustomers).mockResolvedValue(asPage([makeCustomer()]))
    vi.mocked(createTicket).mockResolvedValue(
      makeTicket({ conversation_id: conversation.id }),
    )

    renderWithProviders(<ConversationsInbox />)
    await user.click(await screen.findByRole("button", { name: "Create ticket" }))

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByRole("heading", { name: "Create ticket" }),
    ).toBeInTheDocument()
    expect(within(dialog).getByLabelText("Customer")).toHaveValue("cust-1")
    expect(within(dialog).getByLabelText("Customer")).toBeDisabled()
    expect(
      within(dialog).getByLabelText("Conversation (optional)"),
    ).toHaveValue(conversation.id)
    expect(
      within(dialog).getByLabelText("Conversation (optional)"),
    ).toBeDisabled()

    await user.click(
      within(dialog).getByRole("button", { name: "Create ticket" }),
    )

    await waitFor(() => {
      expect(createTicket).toHaveBeenCalledTimes(1)
    })
    const payload = vi.mocked(createTicket).mock.calls[0][0]
    expect(payload).toMatchObject({
      customer_id: "cust-1",
      conversation_id: "conv-1",
      title: "Refund request",
    })
    expect(payload).not.toHaveProperty("workspace_id")
  }, 10_000)

  it("selects a conversation from the workspace-safe query param", async () => {
    const first = makeConversationApi()
    const second = makeConversationApi({
      id: "conv-2",
      customer_name: "Noah Diaz",
      customer_email: "noah@acme.example",
      last_message: "Shipping is delayed",
      subject: "Shipping delay",
    })
    vi.mocked(listConversations).mockResolvedValue(asPage([first, second]))
    vi.mocked(getConversation).mockImplementation(async (id) =>
      id === "conv-2" ? second : first,
    )
    vi.mocked(listConversationMessages).mockResolvedValue([makeMessageApi()])

    renderWithProviders(<ConversationsInbox />, {
      initialEntries: ["/dashboard/conversations?conversation=conv-2"],
    })

    expect(
      await screen.findByRole("heading", { name: "Noah Diaz" }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(getConversation).toHaveBeenCalledWith("conv-2")
      expect(listTickets).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "conv-2" }),
      )
    })
  })
})
