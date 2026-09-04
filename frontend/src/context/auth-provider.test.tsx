import { AxiosError } from "axios"
import type { InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { useAuth } from "@/context/auth-provider"
import { fetchCurrentUser, loginUser } from "@/services/auth"
import { selectWorkspace } from "@/services/workspaces"
import { resetWorkspaceScopedQueries } from "@/lib/workspace-queries"
import {
  makeAuthUser,
  makeMultiWorkspaceUser,
  makeWorkspaceSummary,
  sampleAuthToken,
  sampleUser,
} from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

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
    resetWorkspaceScopedQueries: vi.fn(),
  }
})

function unauthorizedError() {
  return new AxiosError(
    "Unauthorized",
    AxiosError.ERR_BAD_REQUEST,
    undefined,
    undefined,
    {
      status: 401,
      statusText: "Unauthorized",
      data: { detail: "Unauthorized" },
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig,
    },
  )
}

function AuthProbe() {
  const {
    user,
    token,
    isLoading,
    refreshUser,
    defaultWorkspaceId,
    workspaces,
    currentWorkspace,
    currentWorkspaceRole,
  } = useAuth()

  if (isLoading) {
    return <p>Loading session</p>
  }

  return (
    <div>
      <p>token:{token ?? "none"}</p>
      <p>user:{user?.email ?? "none"}</p>
      <p>default:{defaultWorkspaceId ?? "none"}</p>
      <p>role:{currentWorkspaceRole ?? "none"}</p>
      <p>workspace:{currentWorkspace?.name ?? "none"}</p>
      <p>count:{workspaces.length}</p>
      <ul>
        {workspaces.map((workspace) => (
          <li key={workspace.id}>
            {workspace.id}:{workspace.name}:{workspace.role}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void refreshUser()}>
        Retry
      </button>
    </div>
  )
}

function SwitchProbe() {
  const {
    currentWorkspace,
    currentWorkspaceRole,
    defaultWorkspaceId,
    isLoading,
    selectWorkspace,
  } = useAuth()

  if (isLoading) {
    return <p>Loading session</p>
  }

  return (
    <div>
      <p>default:{defaultWorkspaceId ?? "none"}</p>
      <p>role:{currentWorkspaceRole ?? "none"}</p>
      <p>workspace:{currentWorkspace?.name ?? "none"}</p>
      <button
        type="button"
        onClick={() => {
          void selectWorkspace("workspace-b").catch(() => undefined)
        }}
      >
        Switch to B
      </button>
    </div>
  )
}

function LoginProbe() {
  const {
    user,
    defaultWorkspaceId,
    workspaces,
    currentWorkspace,
    currentWorkspaceRole,
    isLoading,
    login,
  } = useAuth()

  if (isLoading) {
    return <p>Loading session</p>
  }

  return (
    <div>
      <p>user:{user?.email ?? "none"}</p>
      <p>default:{defaultWorkspaceId ?? "none"}</p>
      <p>role:{currentWorkspaceRole ?? "none"}</p>
      <p>workspace:{currentWorkspace?.name ?? "none"}</p>
      <p>count:{workspaces.length}</p>
      <button
        type="button"
        onClick={() =>
          void login({
            email: "ava@acme.example",
            password: "password123",
          })
        }
      >
        Sign in
      </button>
    </div>
  )
}

describe("AuthProvider session restore", () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.mocked(loginUser).mockReset()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("restores the current user when the initial request succeeds", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("user:ava@acme.example")).toBeInTheDocument()
    expect(screen.getByText("token:test-token")).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")
    expect(fetchCurrentUser).toHaveBeenCalledTimes(1)
  })

  it("keeps the token after a recoverable non-401 restore failure", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockRejectedValue(
      new Error("Network Error"),
    )

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("user:none")).toBeInTheDocument()
    expect(screen.getByText("token:test-token")).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")
  })

  it("retries fetchCurrentUser and restores the user from Retry", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce(sampleUser)

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("user:none")).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("user:ava@acme.example")).toBeInTheDocument()
    expect(screen.getByText("token:test-token")).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledTimes(2)
    })
  })

  it("clears the session when restore fails with 401", async () => {
    localStorage.setItem("access_token", "expired-token")
    vi.mocked(fetchCurrentUser).mockRejectedValue(unauthorizedError())

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("user:none")).toBeInTheDocument()
    expect(screen.getByText("token:none")).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBeNull()
    expect(fetchCurrentUser).toHaveBeenCalledTimes(1)
  })

  it("does not retry /auth/me after a 401 has cleared the session", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "expired-token")
    vi.mocked(fetchCurrentUser).mockRejectedValue(unauthorizedError())

    renderWithProviders(<AuthProbe />)
    await screen.findByText("token:none")

    await user.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledTimes(1)
    })
    expect(localStorage.getItem("access_token")).toBeNull()
    expect(screen.getByText("user:none")).toBeInTheDocument()
  })

  it("parses workspace data returned by /auth/me", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(
      makeAuthUser({
        default_workspace_id: "workspace-2",
        workspaces: [
          makeWorkspaceSummary({
            id: "workspace-1",
            name: "First Desk",
            role: "AGENT",
          }),
          makeWorkspaceSummary({
            id: "workspace-2",
            name: "Second Desk",
            role: "ADMIN",
          }),
        ],
      }),
    )

    renderWithProviders(<AuthProbe />)

    expect(await screen.findByText("default:workspace-2")).toBeInTheDocument()
    expect(screen.getByText("role:ADMIN")).toBeInTheDocument()
    expect(screen.getByText("workspace:Second Desk")).toBeInTheDocument()
    expect(screen.getByText("count:2")).toBeInTheDocument()
    expect(screen.getByText("workspace-1:First Desk:AGENT")).toBeInTheDocument()
    expect(screen.getByText("workspace-2:Second Desk:ADMIN")).toBeInTheDocument()
  })
})

describe("AuthProvider login workspace data", () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.mocked(loginUser).mockReset()
  })

  it("keeps /auth/me workspace fields after login", async () => {
    const user = userEvent.setup()
    vi.mocked(loginUser).mockResolvedValue(sampleAuthToken)

    renderWithProviders(<LoginProbe />)
    await user.click(await screen.findByRole("button", { name: "Sign in" }))

    expect(await screen.findByText("user:ava@acme.example")).toBeInTheDocument()
    expect(screen.getByText("default:workspace-1")).toBeInTheDocument()
    expect(screen.getByText("role:OWNER")).toBeInTheDocument()
    expect(screen.getByText("workspace:Acme Support")).toBeInTheDocument()
    expect(screen.getByText("count:1")).toBeInTheDocument()
  })
})

describe("AuthProvider workspace switching", () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.mocked(selectWorkspace).mockReset()
    vi.mocked(resetWorkspaceScopedQueries).mockReset()
  })

  it("updates the selected workspace and role from /auth/me after a server select", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser)
      .mockResolvedValueOnce(makeMultiWorkspaceUser("A"))
      .mockResolvedValueOnce(makeMultiWorkspaceUser("B"))
    vi.mocked(selectWorkspace).mockResolvedValue({
      id: "workspace-b",
      name: "Workspace B",
      owner_user_id: "user-2",
      created_at: "2026-01-15T10:00:00.000Z",
      updated_at: "2026-01-16T10:00:00.000Z",
      role: "AGENT",
    })

    renderWithProviders(<SwitchProbe />)

    expect(await screen.findByText("default:workspace-a")).toBeInTheDocument()
    expect(screen.getByText("role:ADMIN")).toBeInTheDocument()
    expect(screen.getByText("workspace:Workspace A")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Switch to B" }))

    await waitFor(() => {
      expect(selectWorkspace).toHaveBeenCalledWith("workspace-b")
    })
    expect(await screen.findByText("default:workspace-b")).toBeInTheDocument()
    expect(screen.getByText("role:AGENT")).toBeInTheDocument()
    expect(screen.getByText("workspace:Workspace B")).toBeInTheDocument()
    expect(resetWorkspaceScopedQueries).toHaveBeenCalled()
  })

  it("does not change workspace state when server selection fails", async () => {
    const user = userEvent.setup()
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(makeMultiWorkspaceUser("A"))
    vi.mocked(selectWorkspace).mockRejectedValue(
      new Error("Workspace not found."),
    )

    renderWithProviders(<SwitchProbe />)
    expect(await screen.findByText("role:ADMIN")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Switch to B" }))

    await waitFor(() => {
      expect(selectWorkspace).toHaveBeenCalledWith("workspace-b")
    })
    expect(screen.getByText("default:workspace-a")).toBeInTheDocument()
    expect(screen.getByText("role:ADMIN")).toBeInTheDocument()
    expect(resetWorkspaceScopedQueries).not.toHaveBeenCalled()
  })
})
