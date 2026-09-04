import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, Ticket as TicketIcon } from "lucide-react"

import { TicketDetailPanel } from "@/components/tickets/ticket-detail"
import { TicketForm } from "@/components/tickets/ticket-form"
import { TicketList } from "@/components/tickets/ticket-list"
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
  emptyTicketFormValues,
  formValuesFromTicket,
  toCreatePayload,
  toUpdatePayload,
  validateTicketForm,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/ticket-mappers"
import { listCustomers } from "@/services/customers"
import { listTeamMembers } from "@/services/team"
import {
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  updateTicket,
} from "@/services/tickets"
import { teamMemberDisplayName } from "@/lib/team-mappers"
import type { TeamMember } from "@/types/team"
import type { Ticket, TicketFormValues, TicketPriority, TicketStatus } from "@/types/tickets"
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/tickets"
import { DEFAULT_PAGE_SIZE, PICKER_PAGE_SIZE } from "@/types/pagination"
import { getApiErrorMessage } from "@/utils/api-error"

type PanelMode = "closed" | "create" | "edit" | "view" | "delete"

const TICKETS_QUERY_KEY = ["tickets"] as const
const CUSTOMERS_QUERY_KEY = ["customers"] as const
const TEAM_QUERY_KEY = ["team"] as const

function assignableMembers(
  members: TeamMember[],
  currentAssigneeId?: string | null,
): TeamMember[] {
  const active = members.filter((member) => member.status === "ACTIVE")
  if (
    currentAssigneeId &&
    !active.some((member) => member.id === currentAssigneeId)
  ) {
    const current = members.find((member) => member.id === currentAssigneeId)
    if (current) return [...active, current]
  }
  return active
}

const selectClassName =
  "h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"

export function TicketsBoard() {
  const queryClient = useQueryClient()

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("")
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "">("")
  const [assigneeFilter, setAssigneeFilter] = useState("")
  const [page, setPage] = useState(1)
  const [panelMode, setPanelMode] = useState<PanelMode>("closed")
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [formValues, setFormValues] = useState<TicketFormValues>(
    emptyTicketFormValues(),
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
  }, [statusFilter, priorityFilter, assigneeFilter])

  const listParams = {
    query: debouncedSearch || undefined,
    status: statusFilter || undefined,
    priority: priorityFilter || undefined,
    assigneeId:
      assigneeFilter && assigneeFilter !== "unassigned"
        ? assigneeFilter
        : undefined,
    unassigned: assigneeFilter === "unassigned" ? true : undefined,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  }

  const listQuery = useQuery({
    queryKey: [...TICKETS_QUERY_KEY, "list", listParams],
    queryFn: () => listTickets(listParams),
    placeholderData: keepPreviousData,
  })

  const customersQuery = useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, "list", "picker"],
    queryFn: () => listCustomers({ page: 1, pageSize: PICKER_PAGE_SIZE }),
    enabled: panelMode === "create" || panelMode === "edit",
  })

  const teamQuery = useQuery({
    queryKey: [...TEAM_QUERY_KEY, "list", "picker"],
    queryFn: () => listTeamMembers({ page: 1, pageSize: PICKER_PAGE_SIZE }),
  })

  const detailQuery = useQuery({
    queryKey: [...TICKETS_QUERY_KEY, "detail", activeTicket?.id],
    queryFn: () => getTicket(activeTicket!.id),
    enabled: panelMode === "view" && Boolean(activeTicket?.id),
  })

  const tickets = listQuery.data?.items ?? []
  const customers = customersQuery.data?.items ?? []
  const teamMembers = teamQuery.data?.items ?? []
  const listError = listQuery.isError
    ? getApiErrorMessage(listQuery.error, "Unable to load tickets.")
    : null
  const isFiltered = Boolean(
    debouncedSearch || statusFilter || priorityFilter || assigneeFilter,
  )

  const resetPanel = () => {
    setPanelMode("closed")
    setActiveTicket(null)
    setFormError(null)
    setFormValues(emptyTicketFormValues())
  }

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createTicket>[0]) =>
      createTicket(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TICKETS_QUERY_KEY })
      resetPanel()
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to create ticket."))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({
      ticketId,
      payload,
    }: {
      ticketId: string
      payload: Parameters<typeof updateTicket>[1]
    }) => updateTicket(ticketId, payload),
    onSuccess: async (updated) => {
      setActiveTicket(updated)
      await queryClient.invalidateQueries({ queryKey: TICKETS_QUERY_KEY })
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to update ticket."))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (ticketId: string) => deleteTicket(ticketId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TICKETS_QUERY_KEY })
      resetPanel()
    },
    onError: (error) => {
      setFormError(getApiErrorMessage(error, "Unable to delete ticket."))
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending
  const deletingId = deleteMutation.isPending ? activeTicket?.id ?? null : null
  const panelOpen = panelMode !== "closed"

  useEffect(() => {
    if (panelMode === "view" && detailQuery.data) {
      setActiveTicket(detailQuery.data)
    }
  }, [detailQuery.data, panelMode])

  const panelTitle = useMemo(() => {
    if (panelMode === "create") return "New ticket"
    if (panelMode === "edit") return "Edit ticket"
    if (panelMode === "delete") return "Delete ticket"
    return "Ticket details"
  }, [panelMode])

  const closePanel = () => {
    if (isSaving || deleteMutation.isPending) return
    resetPanel()
  }

  const openCreate = () => {
    setActiveTicket(null)
    setFormValues(emptyTicketFormValues())
    setFormError(null)
    setPanelMode("create")
  }

  const openView = (ticket: Ticket) => {
    setActiveTicket(ticket)
    setFormError(null)
    setPanelMode("view")
  }

  const openEdit = (ticket: Ticket) => {
    setActiveTicket(ticket)
    setFormValues(formValuesFromTicket(ticket))
    setFormError(null)
    setPanelMode("edit")
  }

  const openDelete = (ticket: Ticket) => {
    setActiveTicket(ticket)
    setFormError(null)
    setPanelMode("delete")
  }

  const handleCreate = () => {
    const validationError = validateTicketForm(formValues)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    createMutation.mutate(toCreatePayload(formValues))
  }

  const handleUpdate = () => {
    if (!activeTicket) return
    const validationError = validateTicketForm(formValues)
    if (validationError) {
      setFormError(validationError)
      return
    }
    setFormError(null)
    updateMutation.mutate(
      {
        ticketId: activeTicket.id,
        payload: toUpdatePayload(formValues),
      },
      { onSuccess: () => resetPanel() },
    )
  }

  const handleDelete = () => {
    if (!activeTicket) return
    deleteMutation.mutate(activeTicket.id)
  }

  const handleQuickUpdate = (
    ticketId: string,
    payload: Parameters<typeof updateTicket>[1],
  ) => {
    setFormError(null)
    updateMutation.mutate({ ticketId, payload })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <TicketIcon className="size-3.5" />
            Tickets
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Tickets
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Track customer issues with status, priority, and assignment in this
            workspace.
          </p>
        </div>
        <Button type="button" className="rounded-2xl" onClick={openCreate}>
          <Plus className="size-4" />
          New ticket
        </Button>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
        <div>
          <p className="mb-1 text-sm font-semibold text-foreground">
            Search tickets
          </p>
          <p className="mb-3 text-xs text-muted-foreground">
            Search by title or description. Filters apply on the server.
          </p>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title or description…"
            aria-label="Search tickets"
            className="h-11 rounded-2xl bg-background"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-filter-status">Status</Label>
            <select
              id="ticket-filter-status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as TicketStatus | "")
              }
              className={selectClassName}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TICKET_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-filter-priority">Priority</Label>
            <select
              id="ticket-filter-priority"
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as TicketPriority | "")
              }
              className={selectClassName}
              aria-label="Filter by priority"
            >
              <option value="">All priorities</option>
              {TICKET_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {TICKET_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-filter-assignee">Assignee</Label>
            <select
              id="ticket-filter-assignee"
              value={assigneeFilter}
              onChange={(event) => setAssigneeFilter(event.target.value)}
              className={selectClassName}
              aria-label="Filter by assignee"
            >
              <option value="">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {(teamMembers).map((member) => (
                <option key={member.id} value={member.id}>
                  {teamMemberDisplayName(member)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <TicketList
        tickets={tickets}
        isLoading={listQuery.isLoading}
        error={listError}
        isFiltered={isFiltered}
        onRetry={() => void listQuery.refetch()}
        onView={openView}
        onEdit={openEdit}
        onDelete={openDelete}
        deletingId={deletingId}
      />
      <ListPagination
        page={listQuery.data?.page ?? page}
        pageSize={listQuery.data?.pageSize ?? DEFAULT_PAGE_SIZE}
        total={listQuery.data?.total ?? 0}
        hasNext={listQuery.data?.hasNext ?? false}
        onPageChange={setPage}
        itemLabel="tickets"
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
            <TicketForm
              values={formValues}
              onChange={setFormValues}
              onSubmit={handleCreate}
              onCancel={closePanel}
              submitLabel="Create ticket"
              customers={customers}
              customersLoading={customersQuery.isLoading}
              members={assignableMembers(teamMembers)}
              membersLoading={teamQuery.isLoading}
              isSaving={isSaving}
              error={
                formError ??
                (customersQuery.isError
                  ? getApiErrorMessage(
                      customersQuery.error,
                      "Unable to load customers.",
                    )
                  : null)
              }
            />
          ) : null}

          {panelMode === "edit" ? (
            <TicketForm
              values={formValues}
              onChange={setFormValues}
              onSubmit={handleUpdate}
              onCancel={closePanel}
              submitLabel="Save changes"
              customers={customers}
              customersLoading={customersQuery.isLoading}
              members={assignableMembers(
                teamMembers,
                formValues.assignee_id,
              )}
              membersLoading={teamQuery.isLoading}
              isSaving={isSaving}
              error={formError}
            />
          ) : null}

          {panelMode === "view" && activeTicket ? (
            detailQuery.isError && !activeTicket.customer ? (
              <div className="space-y-3 px-4 py-6">
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  {getApiErrorMessage(
                    detailQuery.error,
                    "Unable to load ticket details.",
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
              <TicketDetailPanel
                ticket={activeTicket}
                onEdit={() => openEdit(activeTicket)}
                onClose={closePanel}
                members={assignableMembers(
                  teamMembers,
                  activeTicket.assignee_id,
                )}
                membersLoading={teamQuery.isLoading}
                isSaving={updateMutation.isPending}
                onStatusChange={(status) =>
                  handleQuickUpdate(activeTicket.id, { status })
                }
                onPriorityChange={(priority) =>
                  handleQuickUpdate(activeTicket.id, { priority })
                }
                onAssigneeChange={(assigneeId) =>
                  handleQuickUpdate(activeTicket.id, {
                    assignee_id: assigneeId,
                  })
                }
              />
            )
          ) : null}

          {panelMode === "delete" && activeTicket ? (
            <div className="flex flex-1 flex-col">
              <div className="flex-1 space-y-3 px-4 py-5">
                <p className="text-sm text-foreground">
                  Delete{" "}
                  <span className="font-semibold">{activeTicket.title}</span>?
                  This cannot be undone.
                </p>
                {formError ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    {formError}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={closePanel}
                  disabled={Boolean(deletingId)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl bg-rose-600 text-white hover:bg-rose-700"
                  onClick={handleDelete}
                  disabled={Boolean(deletingId)}
                >
                  {deletingId ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
