import { Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { screen, waitFor } from "@testing-library/react"
import type { UserEvent } from "@testing-library/user-event"

import { RegisterForm } from "@/components/auth/register-form"
import { loginUser, registerUser } from "@/services/auth"
import { sampleAuthToken, sampleUser } from "@/test/fixtures"
import { renderWithProviders } from "@/test/test-utils"

vi.mock("@/services/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  logoutUser: vi.fn(),
  registerUser: vi.fn(),
}))

function renderRegister() {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterForm />} />
      <Route path="/dashboard" element={<div>Dashboard home</div>} />
    </Routes>,
    { initialEntries: ["/register"] },
  )
}

async function fillValidRegisterForm(user: UserEvent) {
  await user.type(screen.getByLabelText("First name"), "Ava")
  await user.type(screen.getByLabelText("Last name"), "Chen")
  await user.type(screen.getByLabelText("Company name"), "Acme Support")
  await user.type(screen.getByLabelText("Work email"), "ava@acme.example")
  await user.type(screen.getByLabelText("Password"), "password123")
  await user.type(screen.getByLabelText("Confirm password"), "password123")
  await user.click(screen.getByRole("checkbox"))
}

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.mocked(registerUser).mockReset()
    vi.mocked(loginUser).mockReset()
  })

  it("renders the register form", async () => {
    renderRegister()

    expect(
      await screen.findByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("First name")).toBeInTheDocument()
    expect(screen.getByLabelText("Last name")).toBeInTheDocument()
    expect(screen.getByLabelText("Company name")).toBeInTheDocument()
    expect(screen.getByLabelText("Work email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument()
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    )
  })

  it("shows required validation when submitted empty", async () => {
    const user = userEvent.setup()
    renderRegister()
    await screen.findByRole("button", { name: "Create account" })

    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByText("First name is required")).toBeInTheDocument()
    expect(screen.getByText("Last name is required")).toBeInTheDocument()
    expect(screen.getByText("Company name is required")).toBeInTheDocument()
    expect(screen.getByText("Work email is required")).toBeInTheDocument()
    expect(screen.getByText("Password is required")).toBeInTheDocument()
    expect(screen.getByText("Please confirm your password")).toBeInTheDocument()
    expect(
      screen.getByText("You must accept the Terms & Conditions"),
    ).toBeInTheDocument()
    expect(registerUser).not.toHaveBeenCalled()
  })

  it("shows an invalid work-email message", async () => {
    const user = userEvent.setup()
    renderRegister()
    await screen.findByLabelText("Work email")

    await user.type(screen.getByLabelText("First name"), "Ava")
    await user.type(screen.getByLabelText("Last name"), "Chen")
    await user.type(screen.getByLabelText("Company name"), "Acme Support")
    await user.type(screen.getByLabelText("Work email"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.type(screen.getByLabelText("Confirm password"), "password123")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(
      await screen.findByText("Enter a valid work email address"),
    ).toBeInTheDocument()
    expect(registerUser).not.toHaveBeenCalled()
  })

  it("requires a password of at least 8 characters", async () => {
    const user = userEvent.setup()
    renderRegister()
    await screen.findByLabelText("Password")

    await user.type(screen.getByLabelText("First name"), "Ava")
    await user.type(screen.getByLabelText("Last name"), "Chen")
    await user.type(screen.getByLabelText("Company name"), "Acme Support")
    await user.type(screen.getByLabelText("Work email"), "ava@acme.example")
    await user.type(screen.getByLabelText("Password"), "short7!")
    await user.type(screen.getByLabelText("Confirm password"), "short7!")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeInTheDocument()
    expect(registerUser).not.toHaveBeenCalled()
  })

  it("shows an error when passwords do not match", async () => {
    const user = userEvent.setup()
    renderRegister()
    await screen.findByLabelText("Password")

    await user.type(screen.getByLabelText("First name"), "Ava")
    await user.type(screen.getByLabelText("Last name"), "Chen")
    await user.type(screen.getByLabelText("Company name"), "Acme Support")
    await user.type(screen.getByLabelText("Work email"), "ava@acme.example")
    await user.type(screen.getByLabelText("Password"), "password123")
    await user.type(screen.getByLabelText("Confirm password"), "password456")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument()
    expect(registerUser).not.toHaveBeenCalled()
  })

  it("registers through the auth service and redirects to the dashboard", async () => {
    const user = userEvent.setup()
    vi.mocked(registerUser).mockResolvedValue(sampleUser)
    vi.mocked(loginUser).mockResolvedValue(sampleAuthToken)
    renderRegister()
    await screen.findByLabelText("First name")

    await fillValidRegisterForm(user)
    await user.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(registerUser).toHaveBeenCalledWith({
        first_name: "Ava",
        last_name: "Chen",
        company_name: "Acme Support",
        email: "ava@acme.example",
        password: "password123",
      })
    })
    expect(loginUser).toHaveBeenCalledWith({
      email: "ava@acme.example",
      password: "password123",
    })
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument()
  })

  it("shows an API error without navigating", async () => {
    const user = userEvent.setup()
    vi.mocked(registerUser).mockRejectedValue(
      new Error("Email already registered"),
    )
    renderRegister()
    await screen.findByLabelText("First name")

    await fillValidRegisterForm(user)
    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email already registered",
    )
    expect(loginUser).not.toHaveBeenCalled()
    expect(screen.queryByText("Dashboard home")).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Create your account" }),
    ).toBeInTheDocument()
  })

  it("keeps Google registration disabled", async () => {
    renderRegister()
    await screen.findByRole("heading", { name: "Create your account" })

    const googleButton = screen.getByRole("button", {
      name: "Continue with Google",
    })
    expect(googleButton).toBeDisabled()
    expect(googleButton).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.getByText("Google login is not available yet."),
    ).toBeInTheDocument()
    expect(registerUser).not.toHaveBeenCalled()
  })
})
