import type {
  Customer,
  CustomerCreatePayload,
  CustomerFormValues,
  CustomerUpdatePayload,
} from "@/types/customers"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function customerDisplayName(customer: {
  first_name: string
  last_name: string
}): string {
  return `${customer.first_name} ${customer.last_name}`.trim()
}

export function customerInitials(customer: {
  first_name: string
  last_name: string
}): string {
  const first = customer.first_name.trim().charAt(0)
  const last = customer.last_name.trim().charAt(0)
  return `${first}${last}`.toUpperCase() || "?"
}

export function formatCustomerDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function emptyCustomerFormValues(): CustomerFormValues {
  return {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
  }
}

export function formValuesFromCustomer(customer: Customer): CustomerFormValues {
  return {
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone ?? "",
    company: customer.company ?? "",
    notes: customer.notes ?? "",
  }
}

export function optionalText(value: string): string | null {
  const cleaned = value.trim()
  return cleaned.length > 0 ? cleaned : null
}

export function toCreatePayload(
  values: CustomerFormValues,
): CustomerCreatePayload {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim(),
    phone: optionalText(values.phone),
    company: optionalText(values.company),
    notes: optionalText(values.notes),
  }
}

export function toUpdatePayload(
  values: CustomerFormValues,
): CustomerUpdatePayload {
  return toCreatePayload(values)
}

export function validateCustomerForm(
  values: CustomerFormValues,
): string | null {
  if (!values.first_name.trim()) return "First name is required."
  if (!values.last_name.trim()) return "Last name is required."
  if (!values.email.trim()) return "Email is required."
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    return "Enter a valid email address."
  }
  return null
}
