import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CustomerFormValues } from "@/types/customers"

type CustomerFormProps = {
  values: CustomerFormValues
  onChange: (values: CustomerFormValues) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  isSaving?: boolean
  error?: string | null
}

export function CustomerForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isSaving = false,
  error = null,
}: CustomerFormProps) {
  const update = <K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
  ) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer-first-name">First name</Label>
            <Input
              id="customer-first-name"
              value={values.first_name}
              onChange={(event) => update("first_name", event.target.value)}
              placeholder="Elena"
              className="h-11 rounded-2xl"
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-last-name">Last name</Label>
            <Input
              id="customer-last-name"
              value={values.last_name}
              onChange={(event) => update("last_name", event.target.value)}
              placeholder="Park"
              className="h-11 rounded-2xl"
              required
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-email">Email</Label>
          <Input
            id="customer-email"
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            placeholder="elena@company.com"
            className="h-11 rounded-2xl"
            required
            disabled={isSaving}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer-phone">Phone</Label>
            <Input
              id="customer-phone"
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+1 555 0100"
              className="h-11 rounded-2xl"
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-company">Company</Label>
            <Input
              id="customer-company"
              value={values.company}
              onChange={(event) => update("company", event.target.value)}
              placeholder="Harbor Retail"
              className="h-11 rounded-2xl"
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customer-notes">Notes</Label>
          <Textarea
            id="customer-notes"
            value={values.notes}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Internal notes for this customer"
            className="min-h-28 rounded-2xl"
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button type="submit" className="rounded-2xl" disabled={isSaving}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSaving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}
