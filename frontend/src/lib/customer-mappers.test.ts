import { describe, expect, it } from "vitest"

import {
  customerDisplayName,
  customerInitials,
  emptyCustomerFormValues,
  toCreatePayload,
  validateCustomerForm,
} from "@/lib/customer-mappers"

describe("customer mappers", () => {
  it("builds a display name and initials", () => {
    expect(
      customerDisplayName({ first_name: "Elena", last_name: "Park" }),
    ).toBe("Elena Park")
    expect(
      customerInitials({ first_name: "Elena", last_name: "Park" }),
    ).toBe("EP")
  })

  it("validates required fields and email", () => {
    expect(validateCustomerForm(emptyCustomerFormValues())).toBe(
      "First name is required.",
    )
    expect(
      validateCustomerForm({
        ...emptyCustomerFormValues(),
        first_name: "Elena",
        last_name: "Park",
        email: "not-an-email",
      }),
    ).toBe("Enter a valid email address.")
    expect(
      validateCustomerForm({
        first_name: "Elena",
        last_name: "Park",
        email: "elena@acme.example",
        phone: "",
        company: "",
        notes: "",
      }),
    ).toBeNull()
  })

  it("omits blank optional fields from create payloads", () => {
    expect(
      toCreatePayload({
        first_name: " Elena ",
        last_name: "Park",
        email: "elena@acme.example",
        phone: "  ",
        company: "Harbor Retail",
        notes: "",
      }),
    ).toEqual({
      first_name: "Elena",
      last_name: "Park",
      email: "elena@acme.example",
      phone: null,
      company: "Harbor Retail",
      notes: null,
    })
  })
})
