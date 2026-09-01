import { describe, expect, it } from "vitest"

import {
  emptyTeamFormValues,
  teamMemberDisplayName,
  toCreatePayload,
  validateTeamForm,
} from "@/lib/team-mappers"
import { makeTeamMember } from "@/test/fixtures"

describe("team mappers", () => {
  it("builds a display name", () => {
    expect(teamMemberDisplayName(makeTeamMember())).toBe("Sarah Perera")
  })

  it("validates required team fields", () => {
    expect(validateTeamForm(emptyTeamFormValues())).toBe("First name is required.")
    expect(
      validateTeamForm({
        ...emptyTeamFormValues(),
        first_name: "Sarah",
      }),
    ).toBe("Last name is required.")
    expect(
      validateTeamForm({
        ...emptyTeamFormValues(),
        first_name: "Sarah",
        last_name: "Perera",
      }),
    ).toBe("Email is required.")
    expect(
      validateTeamForm({
        first_name: "Sarah",
        last_name: "Perera",
        email: "not-an-email",
        role: "AGENT",
        status: "ACTIVE",
      }),
    ).toBe("Enter a valid email address.")
    expect(
      validateTeamForm({
        first_name: "Sarah",
        last_name: "Perera",
        email: "sarah@acme.example",
        role: "AGENT",
        status: "ACTIVE",
      }),
    ).toBeNull()
  })

  it("builds a create payload", () => {
    expect(
      toCreatePayload({
        first_name: " Sarah ",
        last_name: "Perera",
        email: "sarah@acme.example",
        role: "ADMIN",
        status: "ACTIVE",
      }),
    ).toEqual({
      first_name: "Sarah",
      last_name: "Perera",
      email: "sarah@acme.example",
      role: "ADMIN",
      status: "ACTIVE",
    })
  })
})
