import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { customerDisplayName } from "@/lib/customer-mappers"
import type {
  ConversationChannel,
  ConversationCreatePayload,
} from "@/types/conversations"
import type { Customer } from "@/types/customers"

const CHANNELS: ConversationChannel[] = ["Chat", "Email", "Slack"]

export type NewConversationFormValues = {
  customer_id: string
  customer_name: string
  customer_email: string
  subject: string
  initial_message: string
  channel: ConversationChannel
}

export function emptyNewConversationValues(): NewConversationFormValues {
  return {
    customer_id: "",
    customer_name: "",
    customer_email: "",
    subject: "",
    initial_message: "",
    channel: "Chat",
  }
}

export function toConversationCreatePayload(
  values: NewConversationFormValues,
): ConversationCreatePayload {
  const payload: ConversationCreatePayload = {
    customer_name: values.customer_name.trim(),
    customer_email: values.customer_email.trim(),
    subject: values.subject.trim(),
    channel: values.channel,
    initial_message: values.initial_message.trim(),
  }
  const customerId = values.customer_id.trim()
  if (customerId) {
    payload.customer_id = customerId
  }
  return payload
}

export function validateNewConversationValues(
  values: NewConversationFormValues,
): string | null {
  if (!values.customer_name.trim()) return "Customer name is required."
  if (!values.customer_email.trim()) return "Customer email is required."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.customer_email.trim())) {
    return "Enter a valid customer email address."
  }
  if (!values.subject.trim()) return "Subject is required."
  if (!values.initial_message.trim()) {
    return "Initial customer message is required."
  }
  return null
}

const selectClassName =
  "h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"

type NewConversationFormProps = {
  values: NewConversationFormValues
  onChange: (values: NewConversationFormValues) => void
  onSubmit: () => void
  onCancel: () => void
  customers?: Customer[]
  customersLoading?: boolean
  isSaving?: boolean
  error?: string | null
}

export function NewConversationForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  customers = [],
  customersLoading = false,
  isSaving = false,
  error = null,
}: NewConversationFormProps) {
  const update = <K extends keyof NewConversationFormValues>(
    key: K,
    value: NewConversationFormValues[K],
  ) => {
    onChange({ ...values, [key]: value })
  }

  const selectCustomer = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId)
    if (!customer) {
      onChange({ ...values, customer_id: "" })
      return
    }
    onChange({
      ...values,
      customer_id: customer.id,
      customer_name: customerDisplayName(customer),
      customer_email: customer.email,
    })
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
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="conv-customer">Existing customer (optional)</Label>
          <select
            id="conv-customer"
            value={values.customer_id}
            onChange={(event) => selectCustomer(event.target.value)}
            disabled={isSaving || customersLoading}
            className={selectClassName}
          >
            <option value="">
              {customersLoading
                ? "Loading customers…"
                : "Enter name and email below"}
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customerDisplayName(customer)} · {customer.email}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Selecting a customer fills name and email. You can still start a
            conversation without creating a customer.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="conv-customer-name">Customer name</Label>
          <Input
            id="conv-customer-name"
            value={values.customer_name}
            onChange={(event) => update("customer_name", event.target.value)}
            placeholder="e.g. Elena Park"
            className="h-11 rounded-2xl"
            required
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="conv-customer-email">Customer email</Label>
          <Input
            id="conv-customer-email"
            type="email"
            value={values.customer_email}
            onChange={(event) => update("customer_email", event.target.value)}
            placeholder="elena@acme.example"
            className="h-11 rounded-2xl"
            required
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="conv-subject">Subject</Label>
          <Input
            id="conv-subject"
            value={values.subject}
            onChange={(event) => update("subject", event.target.value)}
            placeholder="e.g. Refund request"
            className="h-11 rounded-2xl"
            required
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="conv-channel">Channel</Label>
          <select
            id="conv-channel"
            value={values.channel}
            onChange={(event) =>
              update("channel", event.target.value as ConversationChannel)
            }
            disabled={isSaving}
            className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
          >
            {CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {channel}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            Channel is a label on this thread. Email and Slack are not
            connected as inboxes.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="conv-initial-message">Initial customer message</Label>
          <Textarea
            id="conv-initial-message"
            value={values.initial_message}
            onChange={(event) => update("initial_message", event.target.value)}
            placeholder="e.g. Can I request a refund?"
            className="min-h-28 rounded-2xl"
            required
            disabled={isSaving}
          />
          <p className="text-[11px] text-muted-foreground">
            Stored as a customer message so AI suggestions can use it.
          </p>
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
          {isSaving ? "Creating…" : "Create conversation"}
        </Button>
      </div>
    </form>
  )
}
