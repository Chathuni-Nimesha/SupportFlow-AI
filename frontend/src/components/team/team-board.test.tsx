import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor, within } from "@testing-library/react"

import { TeamBoard } from "@/components/team/team-board"
import {
  createTeamMember,
  deleteTeamMember,
  getTeamMember,
  listTeamMembers,
  updateTeamMember,
} from "@/services/team"
import { makeAgentUser, makeOwnerMember, makeTeamMember,
  asPage,
} from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"
import { fetchCurrentUser } from "@/services/auth"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

vi.mock("@/services/team", () => ({
  listTeamMembers: vi.fn(),
  getTeamMember: vi.fn(),
  createTeamMember: vi.fn(),
  updateTeamMember: vi.fn(),
  deleteTeamMember: vi.fn(),
}))

describe("TeamBoard", () => {
  beforeEach(() => {
    vi.mocked(listTeamMembers).mockReset()
    vi.mocked(getTeamMember).mockReset()
    vi.mocked(createTeamMember).mockReset()
    vi.mocked(updateTeamMember).mockReset()
    vi.mocked(deleteTeamMember).mockReset()
  })

  it("renders the team board chrome", async () => {
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([]))

    renderWithProviders(<TeamBoard />)

    expect(await screen.findByRole("heading", { name: "Team" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "New member" })).toBeInTheDocument()
    expect(screen.getByLabelText("Search team members")).toBeInTheDocument()
    expect(screen.getByLabelText("Filter by role")).toBeInTheDocument()
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument()
    expect(screen.queryByText("Not available")).not.toBeInTheDocument()
    expect(screen.queryByText("Member directory")).not.toBeInTheDocument()
  })

  it("shows a loading state while team members are fetched", async () => {
    const pending = deferred<ReturnType<typeof asPage<ReturnType<typeof makeTeamMember>>>>()
    vi.mocked(listTeamMembers).mockReturnValue(pending.promise)

    renderWithProviders(<TeamBoard />)

    expect(await screen.findByText("Loading team members…")).toBeInTheDocument()

    pending.resolve(asPage([]))
    expect(await screen.findByText("No team members yet")).toBeInTheDocument()
  })

  it("shows an empty state when there are no team members", async () => {
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([]))

    renderWithProviders(<TeamBoard />)

    expect(await screen.findByText("No team members yet")).toBeInTheDocument()
    expect(screen.queryByText("Sarah Perera")).not.toBeInTheDocument()
  })

  it("renders team members from the API", async () => {
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([
      makeOwnerMember(),
      makeTeamMember(),
    ]))

    renderWithProviders(<TeamBoard />)

    expect(await screen.findByText("Sarah Perera")).toBeInTheDocument()
    expect(screen.getAllByText("sarah@acme.example").length).toBeGreaterThan(0)
    expect(screen.getByText("Ava Chen")).toBeInTheDocument()
    expect(screen.getAllByText("Owner").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Agent").length).toBeGreaterThan(0)
  })

  it("shows a list error and retries", async () => {
    const user = userEvent.setup()
    vi.mocked(listTeamMembers)
      .mockRejectedValueOnce(new Error("Unable to load team members."))
      .mockResolvedValueOnce(asPage([makeTeamMember()]))

    renderWithProviders(<TeamBoard />)

    expect(
      await screen.findByText("Couldn’t load team members"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Sarah Perera")).toBeInTheDocument()
    expect(listTeamMembers).toHaveBeenCalledTimes(2)
  })

  it("searches team members through the API", async () => {
    const user = userEvent.setup()
    vi.mocked(listTeamMembers).mockImplementation(async (params = {}) => {
      if (params.query === "sarah") return asPage([makeTeamMember()])
      return asPage([makeOwnerMember(), makeTeamMember()])
    })

    renderWithProviders(<TeamBoard />)
    await screen.findByText("Sarah Perera")

    await user.type(screen.getByLabelText("Search team members"), "sarah")

    await waitFor(() => {
      expect(listTeamMembers).toHaveBeenCalledWith(
        expect.objectContaining({ query: "sarah" }),
      )
    })
  })

  it("filters team members by role and status", async () => {
    const user = userEvent.setup()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([makeTeamMember()]))

    renderWithProviders(<TeamBoard />)
    await screen.findByText("Sarah Perera")

    await user.selectOptions(screen.getByLabelText("Filter by role"), "AGENT")
    await waitFor(() => {
      expect(listTeamMembers).toHaveBeenCalledWith(
        expect.objectContaining({ role: "AGENT" }),
      )
    })

    await user.selectOptions(screen.getByLabelText("Filter by status"), "ACTIVE")
    await waitFor(() => {
      expect(listTeamMembers).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE" }),
      )
    })
  })

  it("creates a team member and shows it in the list", async () => {
    const user = userEvent.setup()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([makeOwnerMember()]))
    const created = makeTeamMember({ id: "member-created" })
    vi.mocked(createTeamMember).mockImplementation(async () => {
      vi.mocked(listTeamMembers).mockResolvedValue(asPage([makeOwnerMember(), created]))
      return created
    })

    renderWithProviders(<TeamBoard />)
    await screen.findByText("Ava Chen")

    await user.click(screen.getByRole("button", { name: "New member" }))
    expect(
      await screen.findByRole("heading", { name: "New team member" }),
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("First name"), "Sarah")
    await user.type(screen.getByLabelText("Last name"), "Perera")
    await user.type(screen.getByLabelText("Email"), "sarah@acme.example")
    await user.click(screen.getByRole("button", { name: "Create member" }))

    await waitFor(() => {
      expect(createTeamMember).toHaveBeenCalledWith({
        first_name: "Sarah",
        last_name: "Perera",
        email: "sarah@acme.example",
        role: "AGENT",
        status: "ACTIVE",
      })
    })
    expect(await screen.findByText("Sarah Perera")).toBeInTheDocument()
  }, 10_000)

  it("keeps the create sheet open and shows an error when create fails", async () => {
    const user = userEvent.setup()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([]))
    vi.mocked(createTeamMember).mockRejectedValue(
      new Error("Unable to create team member."),
    )

    renderWithProviders(<TeamBoard />)
    await user.click(await screen.findByRole("button", { name: "New member" }))

    await user.type(screen.getByLabelText("First name"), "Sarah")
    await user.type(screen.getByLabelText("Last name"), "Perera")
    await user.type(screen.getByLabelText("Email"), "sarah@acme.example")
    await user.click(screen.getByRole("button", { name: "Create member" }))

    expect(
      await screen.findByText("Unable to create team member."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "New team member" }),
    ).toBeInTheDocument()
  })

  it("opens team member details", async () => {
    const user = userEvent.setup()
    const member = makeTeamMember()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([member]))
    vi.mocked(getTeamMember).mockResolvedValue(member)

    renderWithProviders(<TeamBoard />)
    await screen.findByText("Sarah Perera")

    await user.click(screen.getByRole("button", { name: "View Sarah Perera" }))

    const dialog = await screen.findByRole("dialog")
    expect(await within(dialog).findByText("Sarah Perera")).toBeInTheDocument()
    expect(within(dialog).getByText("sarah@acme.example")).toBeInTheDocument()
    expect(within(dialog).getByText("Directory only — cannot sign in")).toBeInTheDocument()
  })

  it("populates the edit form and saves changes", async () => {
    const user = userEvent.setup()
    const member = makeTeamMember()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([member]))
    const updated = makeTeamMember({ role: "ADMIN" })
    vi.mocked(updateTeamMember).mockImplementation(async () => {
      vi.mocked(listTeamMembers).mockResolvedValue(asPage([updated]))
      return updated
    })

    renderWithProviders(<TeamBoard />)
    await user.click(
      await screen.findByRole("button", { name: "Edit Sarah Perera" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Edit team member" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("First name")).toHaveValue("Sarah")

    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "ADMIN")
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(updateTeamMember).toHaveBeenCalledWith(
        "member-1",
        expect.objectContaining({ role: "ADMIN" }),
      )
    })
  })

  it("confirms disable and updates status", async () => {
    const user = userEvent.setup()
    const member = makeTeamMember()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([member]))
    vi.mocked(updateTeamMember).mockImplementation(async () => {
      const disabled = makeTeamMember({ status: "DISABLED" })
      vi.mocked(listTeamMembers).mockResolvedValue(asPage([disabled]))
      return disabled
    })

    renderWithProviders(<TeamBoard />)
    await user.click(
      await screen.findByRole("button", { name: "Disable Sarah Perera" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Disable team member" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/They will no longer be available/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Disable" }))

    await waitFor(() => {
      expect(updateTeamMember).toHaveBeenCalledWith("member-1", {
        status: "DISABLED",
      })
    })
  })

  it("confirms removal and removes the member from the list", async () => {
    const user = userEvent.setup()
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([makeTeamMember()]))
    vi.mocked(deleteTeamMember).mockImplementation(async () => {
      vi.mocked(listTeamMembers).mockResolvedValue(asPage([]))
    })

    renderWithProviders(<TeamBoard />)
    await screen.findByText("Sarah Perera")

    await user.click(
      screen.getByRole("button", { name: "Remove Sarah Perera" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Remove team member" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Assigned tickets will become unassigned/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(deleteTeamMember).toHaveBeenCalledWith("member-1")
    })
    expect(await screen.findByText("No team members yet")).toBeInTheDocument()
  })

  it("does not allow editing or removing the owner", async () => {
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([makeOwnerMember()]))

    renderWithProviders(<TeamBoard />)
    await screen.findByText("Ava Chen")

    expect(screen.getByRole("button", { name: "Edit Ava Chen" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Disable Ava Chen" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remove Ava Chen" })).toBeDisabled()
  })

  it("hides team mutation controls for AGENT while still allowing view", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(makeAgentUser())
    vi.mocked(listTeamMembers).mockResolvedValue(asPage([makeTeamMember()]))
    vi.mocked(getTeamMember).mockResolvedValue(makeTeamMember())

    renderWithProviders(<TeamBoard />)

    expect(await screen.findByText("Sarah Perera")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "New member" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit Sarah Perera" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Disable Sarah Perera" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Remove Sarah Perera" }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "View Sarah Perera" }),
    ).toBeInTheDocument()
  })
})
