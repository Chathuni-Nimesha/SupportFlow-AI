import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen, within } from "@testing-library/react"

import { AppRouter } from "@/routes"
import { fetchCurrentUser } from "@/services/auth"
import { listConversations } from "@/services/conversations"
import { sampleUser, makeAgentUser, asPage } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"
import { listCustomers } from "@/services/customers"
import { listKnowledgeDocuments } from "@/services/knowledge"
import { listTeamMembers } from "@/services/team"
import { listTickets } from "@/services/tickets"

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

vi.mock("@/services/team", () => ({
  listTeamMembers: vi.fn(),
  getTeamMember: vi.fn(),
  createTeamMember: vi.fn(),
  updateTeamMember: vi.fn(),
  deleteTeamMember: vi.fn(),
}))

vi.mock("@/services/knowledge", () => ({
  searchKnowledge: vi.fn(),
  listKnowledgeDocuments: vi.fn(),
  getKnowledgeDocument: vi.fn(),
  createKnowledgeDocument: vi.fn(),
  updateKnowledgeDocument: vi.fn(),
  deleteKnowledgeDocument: vi.fn(),
  ingestKnowledgeDocument: vi.fn(),
}))

vi.mock("@/services/customers", () => ({
  listCustomers: vi.fn(),
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
}))

vi.mock("@/services/tickets", () => ({
  listTickets: vi.fn(),
  getTicket: vi.fn(),
  createTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
}))

function renderApp(path: string) {
  return renderWithProviders(<AppRouter />, { initialEntries: [path] })
}

describe("Landing page and routing smoke", () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.mocked(listConversations).mockReset()
    vi.mocked(listConversations).mockResolvedValue(asPage([]))
    vi.mocked(listTeamMembers).mockReset()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([]))
    vi.mocked(listKnowledgeDocuments).mockReset()
    vi.mocked(listKnowledgeDocuments).mockResolvedValue(asPage([]))
    vi.mocked(listCustomers).mockReset()
    vi.mocked(listCustomers).mockResolvedValue(asPage([]))
    vi.mocked(listTickets).mockReset()
    vi.mocked(listTickets).mockResolvedValue(asPage([]))
  })

  it("renders the landing page with primary navigation and hero CTAs", async () => {
    renderApp("/")

    expect(
      await screen.findByRole("heading", {
        name: "AI-powered customer support workspace",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#main-content")
    expect(
      screen.getByRole("link", { name: "SupportFlow AI home" }),
    ).toBeInTheDocument()

    const primaryNav = screen.getByRole("navigation", { name: "Primary" })
    expect(within(primaryNav).getByRole("link", { name: "Features" })).toHaveAttribute(
      "href",
      "#features",
    )
    expect(within(primaryNav).getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "#how-it-works",
    )
    expect(within(primaryNav).getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "#pricing",
    )

    const loginLinks = screen.getAllByRole("link", { name: "Login" })
    expect(loginLinks.length).toBeGreaterThan(0)
    expect(loginLinks[0]).toHaveAttribute("href", "/login")

    const getStartedLinks = screen.getAllByRole("link", { name: "Get Started" })
    expect(getStartedLinks.length).toBeGreaterThan(0)
    expect(getStartedLinks[0]).toHaveAttribute("href", "/register")

    expect(
      screen.getAllByRole("link", { name: "Get Started" }).length,
    ).toBeGreaterThan(1)
    expect(screen.getAllByRole("link", { name: "Login" }).length).toBeGreaterThan(
      1,
    )
  })

  it("redirects an unknown path to the landing page", async () => {
    renderApp("/some-non-existent-route")

    expect(
      await screen.findByRole("heading", {
        name: "AI-powered customer support workspace",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "SupportFlow AI home" }),
    ).toBeInTheDocument()
  })

  it("renders a representative dashboard route through the router when authenticated", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)

    renderApp("/dashboard/conversations")

    expect(
      await screen.findByRole("heading", { name: "Conversations" }),
    ).toBeInTheDocument()
    expect(await screen.findByText("No conversations found")).toBeInTheDocument()
  })

  it.each([
    ["/dashboard/team", "Team"],
    ["/dashboard/knowledge-base", "Knowledge Base"],
    ["/dashboard/customers", "Customers"],
    ["/dashboard/tickets", "Tickets"],
    ["/dashboard/conversations", "Conversations"],
    ["/dashboard/settings", "Settings"],
    ["/dashboard/ai-assistant", "AI Assistant"],
  ] as const)(
    "keeps %s reachable for AGENT",
    async (path, heading) => {
      localStorage.setItem("access_token", "test-token")
      vi.mocked(fetchCurrentUser).mockResolvedValue(makeAgentUser())

      renderApp(path)

      expect(
        await screen.findByRole("heading", { name: heading }),
      ).toBeInTheDocument()
    },
  )
})
