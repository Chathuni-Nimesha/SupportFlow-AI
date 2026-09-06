import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TEAM_ROLE_LABELS,
  TEAM_STATUS_LABELS,
  formatTeamDate,
  isWorkspaceOwner,
  teamMemberDisplayName,
} from "@/lib/team-mappers"
import type { TeamMember } from "@/types/team"

type TeamDetailPanelProps = {
  member: TeamMember
  onEdit: () => void
  onClose: () => void
  onDisable: () => void
  onDelete: () => void
  canManage?: boolean
}

export function TeamDetailPanel({
  member,
  onEdit,
  onClose,
  onDisable,
  onDelete,
  canManage = false,
}: TeamDetailPanelProps) {
  const name = teamMemberDisplayName(member)
  const owner = isWorkspaceOwner(member)

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-5 px-4 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {name}
            </h2>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            <p className="text-xs text-muted-foreground">
              Updated {formatTeamDate(member.updated_at)}
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Role" value={TEAM_ROLE_LABELS[member.role]} />
            <DetailField
              label="Status"
              value={TEAM_STATUS_LABELS[member.status]}
            />
            <DetailField
              label="Login account"
              value={
                member.user_id
                  ? "Linked to a signed-in account"
                  : "Directory only — cannot sign in"
              }
            />
          </dl>

          {owner ? (
            <p className="rounded-2xl border border-border/80 bg-background px-4 py-3 text-xs text-muted-foreground">
              The workspace owner cannot be disabled or removed.
            </p>
          ) : null}
        </div>
      </ScrollArea>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={onClose}
        >
          Close
        </Button>
        {owner || !canManage ? null : (
          <>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={onDisable}
            >
              {member.status === "DISABLED" ? "Enable member" : "Disable member"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl text-rose-600 hover:text-rose-700"
              onClick={onDelete}
            >
              Remove
            </Button>
            <Button type="button" className="rounded-2xl" onClick={onEdit}>
              Edit member
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}
