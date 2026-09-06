import { Ban, Eye, Loader2, Pencil, Trash2, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  TEAM_ROLE_LABELS,
  TEAM_STATUS_LABELS,
  formatTeamDate,
  isWorkspaceOwner,
  teamMemberDisplayName,
  teamMemberInitials,
} from "@/lib/team-mappers"
import type { TeamMember } from "@/types/team"

type TeamListProps = {
  members: TeamMember[]
  isLoading?: boolean
  error?: string | null
  isFiltered?: boolean
  onRetry?: () => void
  onView: (member: TeamMember) => void
  onEdit: (member: TeamMember) => void
  onDisable: (member: TeamMember) => void
  onDelete: (member: TeamMember) => void
  disablingId?: string | null
  deletingId?: string | null
  canManage?: boolean
}

export function TeamList({
  members,
  isLoading = false,
  error = null,
  isFiltered = false,
  onRetry,
  onView,
  onEdit,
  onDisable,
  onDelete,
  disablingId = null,
  deletingId = null,
  canManage = false,
}: TeamListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card px-4 py-20 text-muted-foreground shadow-soft">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Loading team members…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-10 text-center shadow-soft dark:border-rose-500/30 dark:bg-rose-500/10">
        <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
          Couldn’t load team members
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

  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-16 text-center shadow-soft">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-5" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-semibold text-foreground">
          {isFiltered ? "No matching team members" : "No team members yet"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isFiltered
            ? "Try a different name, email, role, or status."
            : canManage
              ? "Add an agent or admin to this workspace directory."
              : "Workspace members appear here. Ask an owner or admin to add someone."}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft">
      <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_7rem_7rem_auto] gap-3 border-b border-border/70 px-4 py-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase sm:grid">
        <span>Name</span>
        <span>Email</span>
        <span>Role</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-border/70">
        {members.map((member) => {
          const name = teamMemberDisplayName(member)
          const owner = isWorkspaceOwner(member)
          const busy = disablingId === member.id || deletingId === member.id
          return (
            <li
              key={member.id}
              className="flex flex-col gap-3 px-4 py-4 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_7rem_7rem_auto] sm:items-center sm:gap-3"
            >
              <button
                type="button"
                className="flex min-w-0 items-start gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:items-center"
                onClick={() => onView(member)}
              >
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xs font-semibold text-primary sm:mt-0">
                  {teamMemberInitials(member)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground sm:hidden">
                    {member.email}
                  </span>
                  <span className="mt-1 hidden text-[11px] text-muted-foreground sm:block">
                    Updated {formatTeamDate(member.updated_at)}
                  </span>
                </span>
              </button>
              <p className="hidden truncate text-sm text-muted-foreground sm:block">
                {member.email}
              </p>
              <p className="text-sm text-foreground">
                {TEAM_ROLE_LABELS[member.role]}
              </p>
              <p className="text-sm text-foreground">
                {TEAM_STATUS_LABELS[member.status]}
              </p>
              <div className="flex shrink-0 items-center justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  aria-label={`View ${name}`}
                  onClick={() => onView(member)}
                >
                  <Eye className="size-4" />
                </Button>
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-xl"
                      aria-label={`Edit ${name}`}
                      onClick={() => onEdit(member)}
                      disabled={owner}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-xl"
                      aria-label={
                        member.status === "DISABLED"
                          ? `Enable ${name}`
                          : `Disable ${name}`
                      }
                      onClick={() => onDisable(member)}
                      disabled={owner || busy}
                    >
                      {disablingId === member.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Ban className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-xl text-rose-600 hover:text-rose-700"
                      aria-label={`Remove ${name}`}
                      onClick={() => onDelete(member)}
                      disabled={owner || busy}
                    >
                      {deletingId === member.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
