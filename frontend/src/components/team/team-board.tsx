import { useEffect, useMemo, useState, type ReactNode } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Users } from "lucide-react"

import { TeamDetailPanel } from "@/components/team/team-detail"
import { TeamForm } from "@/components/team/team-form"
import { TeamList } from "@/components/team/team-list"
import { ListPagination } from "@/components/common/list-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  TEAM_ROLE_LABELS,
  TEAM_STATUS_LABELS,
  emptyTeamFormValues,
  formValuesFromTeamMember,
  isWorkspaceOwner,
  teamMemberDisplayName,
  toCreatePayload,
  toUpdatePayload,
  validateTeamForm,
} from "@/lib/team-mappers"
import {
  createTeamMember,
  deleteTeamMember,
  getTeamMember,
  listTeamMembers,
  updateTeamMember,
} from "@/services/team"
import {
  TEAM_MEMBER_ROLES,
  TEAM_MEMBER_STATUSES,
  type TeamMember,
  type TeamMemberFormValues,
  type TeamMemberRole,
  type TeamMemberStatus,
} from "@/types/team"
import { DEFAULT_PAGE_SIZE } from "@/types/pagination"
import { getApiErrorMessage } from "@/utils/api-error"
import { useAuth } from "@/context/auth-provider"
import { canManageTeam } from "@/lib/workspace-permissions"

type PanelMode = "closed" | "create" | "edit" | "view" | "delete" | "disable"

const TEAM_QUERY_KEY = ["team"] as const

const selectClassName =
  "h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

export function TeamBoard() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const canManage = !isAuthLoading && canManageTeam(user)
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<TeamMemberRole | "">("")
  const [statusFilter, setStatusFilter] = useState<TeamMemberStatus | "">("")
  const [page, setPage] = useState(1)
  const [panelMode, setPanelMode] = useState<PanelMode>("closed")
  const [activeMember, setActiveMember] = useState<TeamMember | null>(null)
  const [formValues, setFormValues] = useState<TeamMemberFormValues>(
    emptyTeamFormValues(),
  )
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timeoutId)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [roleFilter, statusFilter])

  const listParams = {
    query: debouncedSearch || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  }

  const listQuery = useQuery({
    queryKey: [...TEAM_QUERY_KEY, "list", listParams],
    queryFn: () => listTeamMembers(listParams),
    placeholderData: keepPreviousData,
  })

  const detailQuery = useQuery({
    queryKey: [...TEAM_QUERY_KEY, "detail", activeMember?.id],
    queryFn: () => getTeamMember(activeMember!.id),
    enabled: panelMode === "view" && Boolean(activeMember?.id),
  })

  const members = listQuery.data?.items ?? []
  const listError = listQuery.isError
    ? getApiErrorMessage(listQuery.error, "Unable to load team members.")
    : null
  const isFiltered = Boolean(debouncedSearch || roleFilter || statusFilter)

  const resetPanel = () => {
    setPanelMode("closed")
    setActiveMember(null)
    setFormError(null)
    setFormValues(emptyTeamFormValues())
  }

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createTeamMember>[0]) =>
      createTeamMember(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY })
      resetPanel()
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to create team member."))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      memberId,
      payload,
    }: {
      memberId: string
      payload: Parameters<typeof updateTeamMember>[1]
    }) => updateTeamMember(memberId, payload),
    onSuccess: async (updated) => {
      setActiveMember(updated)
      await queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY })
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to update team member."))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (memberId: string) => deleteTeamMember(memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEY })
      resetPanel()
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to remove team member."))
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending
  const deletingId = deleteMutation.isPending ? activeMember?.id ?? null : null
  const disablingId =
    updateMutation.isPending && panelMode === "disable"
      ? activeMember?.id ?? null
      : null
  const panelOpen = panelMode !== "closed"

  useEffect(() => {
    if (panelMode === "view" && detailQuery.data) {
      setActiveMember(detailQuery.data)
    }
  }, [detailQuery.data, panelMode])

  const panelTitle = useMemo(() => {
    if (panelMode === "create") return "New team member"
    if (panelMode === "edit") return "Edit team member"
    if (panelMode === "delete") return "Remove team member"
    if (panelMode === "disable") {
      return activeMember?.status === "DISABLED"
        ? "Enable team member"
        : "Disable team member"
    }
    return "Team member"
  }, [activeMember?.status, panelMode])

  const closePanel = () => {
    if (isSaving || deleteMutation.isPending) return
    resetPanel()
  }

  const openCreate = () => {
    setActiveMember(null)
    setFormValues(emptyTeamFormValues())
    setFormError(null)
    setPanelMode("create")
  }

  const openView = (member: TeamMember) => {
    setActiveMember(member)
    setFormError(null)
    setPanelMode("view")
  }

  const openEdit = (member: TeamMember) => {
    if (isWorkspaceOwner(member)) return
    setActiveMember(member)
    setFormValues(formValuesFromTeamMember(member))
    setFormError(null)
    setPanelMode("edit")
  }

  const openDelete = (member: TeamMember) => {
    if (isWorkspaceOwner(member)) return
    setActiveMember(member)
    setFormError(null)
    setPanelMode("delete")
  }

  const openDisable = (member: TeamMember) => {
    if (isWorkspaceOwner(member)) return
    setActiveMember(member)
    setFormError(null)
    setPanelMode("disable")
  }

  const handleCreate = () => {
    const validationError = validateTeamForm(formValues)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    createMutation.mutate(toCreatePayload(formValues))
  }

  const handleUpdate = () => {
    if (!activeMember) return
    const validationError = validateTeamForm(formValues)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    updateMutation.mutate(
      {
        memberId: activeMember.id,
        payload: toUpdatePayload(formValues),
      },
      { onSuccess: () => resetPanel() },
    )
  }

  const handleDelete = () => {
    if (!activeMember) return
    deleteMutation.mutate(activeMember.id)
  }

  const handleToggleStatus = () => {
    if (!activeMember) return
    const nextStatus =
      activeMember.status === "DISABLED" ? "ACTIVE" : "DISABLED"
    updateMutation.mutate(
      {
        memberId: activeMember.id,
        payload: { status: nextStatus },
      },
      { onSuccess: () => resetPanel() },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Users className="size-3.5" />
            Team
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Team
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Manage the people who can be assigned to tickets in this workspace.
            Directory members cannot sign in until invitations are added.
          </p>
        </div>
        {canManage ? (
          <Button type="button" className="rounded-2xl" onClick={openCreate}>
            <Plus className="size-4" />
            New member
          </Button>
        ) : null}
      </div>

      <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
        <div>
          <p className="mb-1 text-sm font-semibold text-foreground">
            Search team members
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Search by name or email. Role and status filters apply on the
            server.
          </p>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search team members…"
            aria-label="Search team members"
            className="h-11 rounded-2xl bg-background"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="team-filter-role">Role</Label>
            <select
              id="team-filter-role"
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as TeamMemberRole | "")
              }
              className={selectClassName}
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              {TEAM_MEMBER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {TEAM_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-filter-status">Status</Label>
            <select
              id="team-filter-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TeamMemberStatus | "")
              }
              className={selectClassName}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {TEAM_MEMBER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TEAM_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <TeamList
        members={members}
        isLoading={listQuery.isLoading}
        error={listError}
        isFiltered={isFiltered}
        onRetry={() => void listQuery.refetch()}
        onView={openView}
        onEdit={openEdit}
        onDisable={openDisable}
        onDelete={openDelete}
        canManage={canManage}
        disablingId={disablingId}
        deletingId={deletingId}
      />
      <ListPagination
        page={listQuery.data?.page ?? page}
        pageSize={listQuery.data?.pageSize ?? DEFAULT_PAGE_SIZE}
        total={listQuery.data?.total ?? 0}
        hasNext={listQuery.data?.hasNext ?? false}
        onPageChange={setPage}
        itemLabel="team members"
      />

      <Sheet
        open={panelOpen}
        onOpenChange={(open) => {
          if (!open && !isSaving && !deleteMutation.isPending) {
            closePanel()
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border/70 px-4 py-4 text-left">
            <SheetTitle>{panelTitle}</SheetTitle>
          </SheetHeader>

          {panelMode === "create" ? (
            <TeamForm
              values={formValues}
              onChange={setFormValues}
              onSubmit={handleCreate}
              onCancel={closePanel}
              submitLabel="Create member"
              isSaving={isSaving}
              error={formError}
            />
          ) : null}

          {panelMode === "edit" ? (
            <TeamForm
              values={formValues}
              onChange={setFormValues}
              onSubmit={handleUpdate}
              onCancel={closePanel}
              submitLabel="Save changes"
              isSaving={isSaving}
              error={formError}
            />
          ) : null}

          {panelMode === "view" && activeMember ? (
            detailQuery.isError && !activeMember.email ? (
              <div className="space-y-3 px-4 py-6">
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  {getApiErrorMessage(
                    detailQuery.error,
                    "Unable to load team member.",
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={closePanel}
                >
                  Close
                </Button>
              </div>
            ) : (
              <TeamDetailPanel
                member={detailQuery.data ?? activeMember}
                onEdit={() => openEdit(detailQuery.data ?? activeMember)}
                onClose={closePanel}
                onDisable={() =>
                  openDisable(detailQuery.data ?? activeMember)
                }
                onDelete={() => openDelete(detailQuery.data ?? activeMember)}
                canManage={canManage}
              />
            )
          ) : null}

          {panelMode === "delete" && activeMember ? (
            <ConfirmPanel
              message={
                <>
                  Remove{" "}
                  <span className="font-semibold">
                    {teamMemberDisplayName(activeMember)}
                  </span>
                  ? Assigned tickets will become unassigned. This cannot be
                  undone.
                </>
              }
              error={formError}
              confirmLabel={deletingId ? "Removing…" : "Remove"}
              confirming={Boolean(deletingId)}
              onCancel={closePanel}
              onConfirm={handleDelete}
            />
          ) : null}

          {panelMode === "disable" && activeMember ? (
            <ConfirmPanel
              message={
                activeMember.status === "DISABLED" ? (
                  <>
                    Enable{" "}
                    <span className="font-semibold">
                      {teamMemberDisplayName(activeMember)}
                    </span>
                    ? They will be available for ticket assignment again.
                  </>
                ) : (
                  <>
                    Disable{" "}
                    <span className="font-semibold">
                      {teamMemberDisplayName(activeMember)}
                    </span>
                    ? They will no longer be available for new ticket
                    assignments.
                  </>
                )
              }
              error={formError}
              confirmLabel={
                disablingId
                  ? "Saving…"
                  : activeMember.status === "DISABLED"
                    ? "Enable"
                    : "Disable"
              }
              confirming={Boolean(disablingId)}
              onCancel={closePanel}
              onConfirm={handleToggleStatus}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function ConfirmPanel({
  message,
  error,
  confirmLabel,
  confirming,
  onCancel,
  onConfirm,
}: {
  message: ReactNode
  error?: string | null
  confirmLabel: string
  confirming: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-3 px-4 py-5">
        <p className="text-sm text-foreground">{message}</p>
        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={onCancel}
          disabled={confirming}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="rounded-2xl bg-rose-600 text-white hover:bg-rose-700"
          onClick={onConfirm}
          disabled={confirming}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
