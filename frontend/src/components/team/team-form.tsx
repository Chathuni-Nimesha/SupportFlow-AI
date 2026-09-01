import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TEAM_ROLE_LABELS, TEAM_STATUS_LABELS } from "@/lib/team-mappers"
import {
  ASSIGNABLE_TEAM_ROLES,
  TEAM_MEMBER_STATUSES,
  type AssignableTeamRole,
  type TeamMemberFormValues,
  type TeamMemberStatus,
} from "@/types/team"

const selectClassName =
  "h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"

type TeamFormProps = {
  values: TeamMemberFormValues
  onChange: (values: TeamMemberFormValues) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  isSaving?: boolean
  error?: string | null
}

export function TeamForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  isSaving = false,
  error = null,
}: TeamFormProps) {
  const update = <K extends keyof TeamMemberFormValues>(
    key: K,
    value: TeamMemberFormValues[K],
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

        <p className="text-xs text-muted-foreground">
          Team members are a workspace directory used for ticket assignment.
          They cannot sign in until account invitations are added.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="team-first-name">First name</Label>
            <Input
              id="team-first-name"
              value={values.first_name}
              onChange={(event) => update("first_name", event.target.value)}
              placeholder="Sarah"
              className="h-11 rounded-2xl"
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-last-name">Last name</Label>
            <Input
              id="team-last-name"
              value={values.last_name}
              onChange={(event) => update("last_name", event.target.value)}
              placeholder="Perera"
              className="h-11 rounded-2xl"
              required
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-email">Email</Label>
          <Input
            id="team-email"
            type="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            placeholder="sarah@company.com"
            className="h-11 rounded-2xl"
            required
            disabled={isSaving}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="team-role">Role</Label>
            <select
              id="team-role"
              value={values.role}
              onChange={(event) =>
                update("role", event.target.value as AssignableTeamRole)
              }
              className={selectClassName}
              disabled={isSaving}
            >
              {ASSIGNABLE_TEAM_ROLES.map((role) => (
                <option key={role} value={role}>
                  {TEAM_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-status">Status</Label>
            <select
              id="team-status"
              value={values.status}
              onChange={(event) =>
                update("status", event.target.value as TeamMemberStatus)
              }
              className={selectClassName}
              disabled={isSaving}
            >
              {TEAM_MEMBER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TEAM_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
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
