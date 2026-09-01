import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"

import { LoginForm } from "@/components/auth/login-form"
import { loginUser } from "@/services/auth"
import { sampleAuthToken } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginForm />} />
      <Route path="/dashboard" element={<div>Dashboard home</div>} />
    </Routes>,
    { initialEntries: ["/login"] },
  )
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.mocked(loginUser).mockReset()
  })

  it("renders the login form", async () => {
    renderLogin()

    expect(
      await screen.findByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
    expect(
      screen.getByText("Password reset is not available yet."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Remember me/i)).not.toBeInTheDocument()
  })

  it("shows required validation when submitted empty", async () => {
    const user = userEvent.setup()
    renderLogin()
    await screen.findByRole("button", { name: "Sign in" })

    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByText("Email is required")).toBeInTheDocument()
    expect(screen.getByText("Password is required")).toBeInTheDocument()
    expect(loginUser).not.toHaveBeenCalled()
  })

  it("shows an invalid-email message", async () => {
    const user = userEvent.setup()
    renderLogin()
    await screen.findByLabelText("Email")

    await user.type(screen.getByLabelText("Email"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument()
    expect(loginUser).not.toHaveBeenCalled()
  })

  it("signs in through the auth service and redirects", async () => {
    const user = userEvent.setup()
    vi.mocked(loginUser).mockResolvedValue(sampleAuthToken)
    renderLogin()
    await screen.findByLabelText("Email")

    await user.type(screen.getByLabelText("Email"), "ava@acme.example")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalledWith({
        email: "ava@acme.example",
        password: "password123",
      })
    })
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument()
  })

  it("shows an API error without navigating", async () => {
    const user = userEvent.setup()
    vi.mocked(loginUser).mockRejectedValue(new Error("Invalid credentials"))
    renderLogin()
    await screen.findByLabelText("Email")

    await user.type(screen.getByLabelText("Email"), "ava@acme.example")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials",
    )
    expect(screen.queryByText("Dashboard home")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument()
  })
})
