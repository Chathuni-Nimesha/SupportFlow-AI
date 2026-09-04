import { AxiosError } from "axios"
import type { InternalAxiosRequestConfig } from "axios"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { screen } from "@testing-library/react"

import { AppRouter } from "@/routes"
import { fetchCurrentUser } from "@/services/auth"
import { listConversations } from "@/services/conversations"
import { sampleUser,
  asPage,
} from "@/test/fixtures"
import { deferred, renderWithProviders } from "@/test/test-utils"

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

function renderApp(path: string) {
  return renderWithProviders(<AppRouter />, { initialEntries: [path] })
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.mocked(fetchCurrentUser).mockReset()
    vi.mocked(listConversations).mockReset()
    vi.mocked(listConversations).mockResolvedValue(asPage([]))
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it.each(["/dashboard", "/dashboard/conversations"] as const)(
    "redirects unauthenticated users from %s to /login",
    async (path) => {
      renderApp(path)

      expect(
        await screen.findByText(
          "Sign in to manage conversations, knowledge, and AI performance.",
        ),
      ).toBeInTheDocument()
      expect(screen.getByLabelText("Email")).toBeInTheDocument()
      expect(
        screen.queryByText(
          "Review conversations and knowledge in your workspace.",
        ),
      ).not.toBeInTheDocument()
    },
  )

  it("renders a protected dashboard page for an authenticated user", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockResolvedValue(sampleUser)

    renderApp("/dashboard")

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Ava" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Review conversations and knowledge in your workspace.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        "Sign in to manage conversations, knowledge, and AI performance.",
      ),
    ).not.toBeInTheDocument()
  })

  it("shows the session loading state and hides protected content until auth resolves", async () => {
    localStorage.setItem("access_token", "test-token")
    const pending = deferred<typeof sampleUser>()
    vi.mocked(fetchCurrentUser).mockReturnValue(pending.promise)

    renderApp("/dashboard")

    expect(
      await screen.findByText("Checking your session…"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        "Review conversations and knowledge in your workspace.",
      ),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        "Sign in to manage conversations, knowledge, and AI performance.",
      ),
    ).not.toBeInTheDocument()

    pending.resolve(sampleUser)

    expect(
      await screen.findByRole("heading", { name: "Welcome back, Ava" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Checking your session…"),
    ).not.toBeInTheDocument()
  })

  it("redirects to /login when session restore fails with 401", async () => {
    localStorage.setItem("access_token", "expired-token")
    vi.mocked(fetchCurrentUser).mockRejectedValue(unauthorizedError())

    renderApp("/dashboard")

    expect(
      await screen.findByText(
        "Sign in to manage conversations, knowledge, and AI performance.",
      ),
    ).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBeNull()
    expect(
      screen.queryByText(
        "Review conversations and knowledge in your workspace.",
      ),
    ).not.toBeInTheDocument()
  })

  it("redirects to /login after a recoverable restore failure because there is no user", async () => {
    localStorage.setItem("access_token", "test-token")
    vi.mocked(fetchCurrentUser).mockRejectedValue(new Error("Network Error"))

    renderApp("/dashboard")

    expect(
      await screen.findByText(
        "Sign in to manage conversations, knowledge, and AI performance.",
      ),
    ).toBeInTheDocument()
    expect(localStorage.getItem("access_token")).toBe("test-token")
    expect(
      screen.queryByText(
        "Review conversations and knowledge in your workspace.",
      ),
    ).not.toBeInTheDocument()
  })

  it("allows unauthenticated access to the landing page", async () => {
    renderApp("/")

    expect(
      await screen.findByRole("heading", {
        name: "AI-powered customer support workspace",
      }),
    ).toBeInTheDocument()
  })

  it("allows unauthenticated access to /login", async () => {
    renderApp("/login")

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
  })

  it("allows unauthenticated access to /register", async () => {
    renderApp("/register")

    expect(
      await screen.findByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Work email")).toBeInTheDocument()
  })
})
