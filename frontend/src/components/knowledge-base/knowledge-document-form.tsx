import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  formatIngestionStatus,
  knowledgeAiAvailabilityMessage,
} from "@/lib/knowledge-mappers"
import { cn } from "@/lib/utils"
import type {
  KnowledgeDocumentFormValues,
  KnowledgeIngestionStatus,
  KnowledgeSourceType,
  KnowledgeStatus,
} from "@/types/knowledge"

const SOURCE_TYPES: KnowledgeSourceType[] = ["manual", "url", "file"]
const STATUSES: KnowledgeStatus[] = ["Draft", "Published"]

type KnowledgeDocumentFormProps = {
  values: KnowledgeDocumentFormValues
  onChange: (values: KnowledgeDocumentFormValues) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  isSaving?: boolean
  error?: string | null
}

export function KnowledgeDocumentForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isSaving = false,
  error = null,
}: KnowledgeDocumentFormProps) {
  const update = <K extends keyof KnowledgeDocumentFormValues>(
    key: K,
    value: KnowledgeDocumentFormValues[K],
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
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="kb-title">Title</Label>
          <Input
            id="kb-title"
            value={values.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="e.g. Handling duplicate invoice charges"
            className="h-11 rounded-2xl"
            required
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kb-content">Content</Label>
          <Textarea
            id="kb-content"
            value={values.content}
            onChange={(event) => update("content", event.target.value)}
            placeholder="Write the knowledge article content…"
            className="min-h-40 rounded-2xl"
            required
            disabled={isSaving}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kb-source-type">Source type</Label>
            <select
              id="kb-source-type"
              value={values.source_type}
              onChange={(event) =>
                update("source_type", event.target.value as KnowledgeSourceType)
              }
              disabled={isSaving}
              className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              {SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kb-status">Status</Label>
            <select
              id="kb-status"
              value={values.status}
              onChange={(event) =>
                update("status", event.target.value as KnowledgeStatus)
              }
              disabled={isSaving}
              className="h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <p
              className={cn(
                "text-[11px]",
                values.status === "Draft"
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-muted-foreground",
              )}
            >
              {knowledgeAiAvailabilityMessage(values.status)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="kb-source">Source</Label>
          <Input
            id="kb-source"
            value={values.source}
            onChange={(event) => update("source", event.target.value)}
            placeholder="Optional URL or source label"
            className="h-11 rounded-2xl"
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kb-tags">Tags</Label>
          <Input
            id="kb-tags"
            value={values.tags}
            onChange={(event) => update("tags", event.target.value)}
            placeholder="billing, refunds, sso"
            className="h-11 rounded-2xl"
            disabled={isSaving}
          />
          <p className="text-[11px] text-muted-foreground">
            Separate tags with commas.
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
          {isSaving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function KnowledgeStatusBadge({ status }: { status: KnowledgeStatus }) {
  return (
    <Badge
      variant="secondary"
      className={
        status === "Published"
          ? "rounded-full border-0 bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "rounded-full border-0 bg-slate-100 font-medium text-slate-700 dark:bg-slate-500/15 dark:text-slate-300"
      }
    >
      {status}
    </Badge>
  )
}

const INGESTION_BADGE_CLASS: Record<KnowledgeIngestionStatus, string> = {
  indexed:
    "rounded-full border-0 bg-emerald-50 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  pending:
    "rounded-full border-0 bg-amber-50 font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200",
  failed:
    "rounded-full border-0 bg-rose-50 font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  not_indexed:
    "rounded-full border-0 bg-slate-100 font-medium text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
}

export function KnowledgeIngestionBadge({
  status,
}: {
  status: KnowledgeIngestionStatus
}) {
  return (
    <Badge variant="secondary" className={INGESTION_BADGE_CLASS[status]}>
      {formatIngestionStatus(status)}
    </Badge>
  )
}

export function KnowledgeAiAvailabilityNotice({
  status,
}: {
  status: KnowledgeStatus
}) {
  const isDraft = status === "Draft"
  return (
    <p
      className={cn(
        "rounded-xl border px-3 py-2 text-xs",
        isDraft
          ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
      )}
    >
      {knowledgeAiAvailabilityMessage(status)}
    </p>
  )
}
