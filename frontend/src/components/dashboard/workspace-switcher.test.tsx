import { describe, expect, it, vi, beforeEach } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher"
import { WelcomeHeader } from "@/components/dashboard/home/welcome-header"
import { TeamBoard } from "@/components/team/team-board"
import { KnowledgeBaseBoard } from "@/components/knowledge-base/knowledge-base-board"
import { CustomersBoard } from "@/components/customers/customers-board"
import { fetchCurrentUser } from "@/services/auth"
import { selectWorkspace } from "@/services/workspaces"
import { listTeamMembers } from "@/services/team"
import { listKnowledgeDocuments } from "@/services/knowledge"
import { listCustomers } from "@/services/customers"
import { listTickets } from "@/services/tickets"
import { makeCustomer, makeMultiWorkspaceUser, makeTeamMember, asPage } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"
import { resetWorkspaceScopedQueries } from "@/lib/workspace-queries"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

vi.mock("@/services/workspaces", () => ({
  updateWorkspace: vi.fn(),
  selectWorkspace: vi.fn(),
}))

vi.mock("@/lib/workspace-queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workspace-queries")>(
    "@/lib/workspace-queries",
  )
  return {
    ...actual,
    resetWorkspaceScopedQueries: vi.fn(actual.resetWorkspaceScopedQueries),
  }
})

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

const customerA = makeCustomer({
  id: "cust-a",
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@workspace-a.example",
})
const customerB = makeCustomer({
  id: "cust-b",
  first_name: "Ben",
  last_name: "Byte",
  email: "ben@workspace-b.example",
})

async function switchTo(user: ReturnType<typeof userEvent.setup>, workspaceId: string) {
  await user.selectOptions(screen.getByLabelText("Workspace"), workspaceId)
}

describe("workspace selector", () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.mocked(selectWorkspace).mockReset()
    vi.mocked(listTeamMembers).mockReset()
    vi.mocked(listKnowledgeDocuments).mockReset()
    vi.mocked(listCustomers).mockReset()
    vi.mocked(listTickets).mockReset()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([makeTeamMember()]))
    vi.mocked(listKnowledgeDocuments).mockResolvedValue(asPage([]))
    vi.mocked(listTickets).mockResolvedValue(asPage([]))
    vi.mocked(selectWorkspace).mockImplementation(async (workspaceId) => ({
      id: workspaceId,
      name: workspaceId === "workspace-b" ? "Workspace B" : "Workspace A",
      owner_user_id: "user-2",
      created_at: "2026-01-15T10:00:00.000Z",
      updated_at: "2026-01-16T10:00:00.000Z",
      role: workspaceId === "workspace-b" ? "AGENT" : "ADMIN",
    }))
  })

  it("renders available workspaces from /auth/me", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(makeMultiWorkspaceUser("A"))

    renderWithProviders(<WorkspaceSwitcher />)

    const selector = await screen.findByLabelText("Workspace")
    expect(selector).toHaveValue("workspace-a")
    expect(screen.getByRole("option", { name: "Workspace A · Admin" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Workspace B · Agent" })).toBeInTheDocument()
  })

  it("calls the server select endpoint and does not send workspace_id in a body", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser)
      .mockResolvedValueOnce(makeMultiWorkspaceUser("A"))
      .mockResolvedValueOnce(makeMultiWorkspaceUser("B"))

    renderWithProviders(<WorkspaceSwitcher />)
    await screen.findByLabelText("Workspace")
    await switchTo(user, "workspace-b")

    await waitFor(() => {
      expect(selectWorkspace).toHaveBeenCalledWith("workspace-b")
    })
    expect(selectWorkspace).toHaveBeenCalledTimes(1)
    expect(vi.mocked(selectWorkspace).mock.calls[0]).toEqual(["workspace-b"])
  })

  it("updates role-aware UX after switching between ADMIN and AGENT workspaces", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser)
      .mockResolvedValueOnce(makeMultiWorkspaceUser("A"))
      .mockResolvedValueOnce(makeMultiWorkspaceUser("B"))
      .mockResolvedValueOnce(makeMultiWorkspaceUser("A"))
    vi.mocked(listCustomers)
      .mockResolvedValueOnce(asPage([customerA]))
      .mockResolvedValueOnce(asPage([customerB]))
      .mockResolvedValueOnce(asPage([customerA]))

    renderWithProviders(
      <>
        <WorkspaceSwitcher />
        <WelcomeHeader />
        <TeamBoard />
        <KnowledgeBaseBoard />
        <CustomersBoard />
      </>,
    )

    expect(await screen.findByRole("button", { name: "New member" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New document" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Upload docs/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /New conversation/ })).toBeInTheDocument()
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument()

    await switchTo(user, "workspace-b")

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "New member" })).not.toBeInTheDocument()
    })
    expect(screen.queryByRole("button", { name: "New document" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Upload docs/ })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /New conversation/ })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Open AI assistant/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New customer" })).toBeInTheDocument()
    expect(await screen.findByText("Ben Byte")).toBeInTheDocument()
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument()
    expect(resetWorkspaceScopedQueries).toHaveBeenCalled()

    await switchTo(user, "workspace-a")

    expect(await screen.findByRole("button", { name: "New member" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New document" })).toBeInTheDocument()
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument()
    expect(screen.queryByText("Ben Byte")).not.toBeInTheDocument()
  })
})
