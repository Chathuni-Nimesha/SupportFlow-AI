import { Eye, Loader2, Pencil, Trash2, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  customerDisplayName,
  customerInitials,
  formatCustomerDate,
} from "@/lib/customer-mappers"
import type { Customer } from "@/types/customers"

type CustomerListProps = {
  customers: Customer[]
  isLoading?: boolean
  error?: string | null
  isFiltered?: boolean
  onRetry?: () => void
  onView: (customer: Customer) => void
  onEdit: (customer: Customer) => void
  onDelete: (customer: Customer) => void
  deletingId?: string | null
}

export function CustomerList({
  customers,
  isLoading = false,
  error = null,
  isFiltered = false,
  onRetry,
  onView,
  onEdit,
  onDelete,
  deletingId = null,
}: CustomerListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card px-4 py-20 text-muted-foreground shadow-soft">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Loading customers…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-10 text-center shadow-soft dark:border-rose-500/30 dark:bg-rose-500/10">
        <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
          Couldn’t load customers
        </p>
        <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">
          {error}
        </p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 rounded-xl"
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-16 text-center shadow-soft">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-5" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-semibold text-foreground">
          {isFiltered ? "No matching customers" : "No customers yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isFiltered
            ? "Try a different name, email, or company."
            : "Create a customer record to keep contact details with your workspace."}
        </p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft">
      {customers.map((customer) => {
        const name = customerDisplayName(customer)
        return (
          <li
            key={customer.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => onView(customer)}
            >
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xs font-semibold text-primary">
                {customerInitials(customer)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {customer.email}
                  {customer.company ? ` · ${customer.company}` : ""}
                </span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Updated {formatCustomerDate(customer.updated_at)}
                </span>
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl"
                aria-label={`View ${name}`}
                onClick={() => onView(customer)}
              >
                <Eye className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl"
                aria-label={`Edit ${name}`}
                onClick={() => onEdit(customer)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl text-rose-600 hover:text-rose-700"
                aria-label={`Delete ${name}`}
                onClick={() => onDelete(customer)}
                disabled={deletingId === customer.id}
              >
                {deletingId === customer.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
