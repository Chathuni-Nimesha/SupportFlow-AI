import { useCallback, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PanelRightOpen, SlidersHorizontal } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { AiAssistantPanel } from "@/components/conversations/ai-assistant-panel"
import { ConversationDetail } from "@/components/conversations/conversation-detail"
import { ConversationFilters } from "@/components/conversations/conversation-filters"
import { ConversationList } from "@/components/conversations/conversation-list"
import {
  emptyNewConversationValues,
  NewConversationForm,
  toConversationCreatePayload,
  validateNewConversationValues,
  type NewConversationFormValues,
} from "@/components/conversations/new-conversation-form"
import { TicketForm } from "@/components/tickets/ticket-form"
import { conversationFilterDefs } from "@/data/conversations"
import type {
  Conversation,
  ConversationApi,
  ConversationFilter,
  ConversationStatus,
} from "@/types/conversations"
import type { Customer } from "@/types/customers"
import type { TeamMember } from "@/types/team"
import type { Ticket, TicketFormValues } from "@/types/tickets"
import { PICKER_PAGE_SIZE } from "@/types/pagination"
import {
  formatRelativeTime,
  mapConversationFromApi,
  mapMessageFromApi,
  mergeConversationUpdate,
  statusToFilterTags,
} from "@/lib/conversation-mappers"
import {
  emptyTicketFormValues,
  ticketFormFromConversation,
  toCreatePayload,
  validateTicketForm,
} from "@/lib/ticket-mappers"
import {
  createConversation,
  getConversation,
  listConversationMessages,
  listConversations,
  sendConversationMessage,
  updateConversation,
} from "@/services/conversations"
import { listCustomers } from "@/services/customers"
import { createTicket, listTickets } from "@/services/tickets"
import { listTeamMembers } from "@/services/team"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { getApiErrorMessage } from "@/utils/api-error"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-provider"

function filterConversations(
  items: Conversation[],
  filter: ConversationFilter,
  search: string,
) {
  const query = search.trim().toLowerCase()

  return items.filter((item) => {
    const matchesFilter =
      filter === "inbox"
        ? item.filterTags.includes("inbox")
        : item.filterTags.includes(filter)

    const matchesSearch =
      query.length === 0 ||
      item.customerName.toLowerCase().includes(query) ||
      item.lastMessage.toLowerCase().includes(query) ||
      item.customerEmail.toLowerCase().includes(query) ||
      item.subject.toLowerCase().includes(query)

    return matchesFilter && matchesSearch
  })
}

function buildFilterCounts(
  items: Conversation[],
): Record<ConversationFilter, number> {
  const counts = Object.fromEntries(
    conversationFilterDefs.map((filter) => [filter.id, 0]),
  ) as Record<ConversationFilter, number>

  for (const item of items) {
    for (const tag of item.filterTags) {
      counts[tag] += 1
    }
  }

  return counts
}

export function ConversationsInbox() {
  const { currentWorkspace } = useAuth()
  const workspaceId = currentWorkspace?.id ?? null
  const [searchParams] = useSearchParams()
  const requestedConversationId = searchParams.get("conversation")?.trim() || null
  const [filter, setFilter] = useState<ConversationFilter>("inbox")
  const [search, setSearch] = useState("")
  const [items, setItems] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [ticketCreateOpen, setTicketCreateOpen] = useState(false)

  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [createValues, setCreateValues] = useState<NewConversationFormValues>(
    emptyNewConversationValues(),
  )
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [linkedTickets, setLinkedTickets] = useState<Ticket[]>([])
  const [linkedTicketsLoading, setLinkedTicketsLoading] = useState(false)
  const [linkedTicketsError, setLinkedTicketsError] = useState<string | null>(null)
  const [ticketValues, setTicketValues] = useState<TicketFormValues>(
    emptyTicketFormValues(),
  )
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [isCreatingTicket, setIsCreatingTicket] = useState(false)

  const filtered = useMemo(
    () => filterConversations(items, filter, search),
    [items, filter, search],
  )

  const filterCounts = useMemo(() => buildFilterCounts(items), [items])

  const activeConversation =
    items.find((item) => item.id === activeId) ??
    filtered.find((item) => item.id === activeId) ??
    null

  const loadConversations = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const page = await listConversations({ page: 1, pageSize: 100 })
      const mapped = page.items.map((item) => mapConversationFromApi(item))
      setItems(mapped)
      setActiveId((current) => {
        if (
          requestedConversationId &&
          mapped.some((item) => item.id === requestedConversationId)
        ) {
          return requestedConversationId
        }
        if (current && mapped.some((item) => item.id === current)) {
          return current
        }
        return mapped[0]?.id ?? null
      })
    } catch (error) {
      setListError(
        getApiErrorMessage(error, "Unable to load conversations."),
      )
      setItems([])
      setActiveId(null)
    } finally {
      setListLoading(false)
    }
  }, [workspaceId, requestedConversationId])

  useEffect(() => {
    if (!createOpen && !ticketCreateOpen) return

    let cancelled = false
    setCustomersLoading(true)
    void listCustomers({ page: 1, pageSize: PICKER_PAGE_SIZE })
      .then((page) => {
        if (!cancelled) setCustomers(page.items)
      })
      .catch(() => {
        if (!cancelled) setCustomers([])
      })
      .finally(() => {
        if (!cancelled) setCustomersLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [createOpen, ticketCreateOpen, workspaceId])

  useEffect(() => {
    if (!ticketCreateOpen) return

    let cancelled = false
    setMembersLoading(true)
    void listTeamMembers({ page: 1, pageSize: PICKER_PAGE_SIZE })
      .then((page) => {
        if (!cancelled) {
          setMembers(page.items.filter((member) => member.status === "ACTIVE"))
        }
      })
      .catch(() => {
        if (!cancelled) setMembers([])
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ticketCreateOpen, workspaceId])

  useEffect(() => {
    if (!activeId) {
      setLinkedTickets([])
      setLinkedTicketsError(null)
      return
    }

    let cancelled = false
    setLinkedTicketsLoading(true)
    setLinkedTicketsError(null)
    void listTickets({
      conversationId: activeId,
      page: 1,
      pageSize: PICKER_PAGE_SIZE,
    })
      .then((page) => {
        if (!cancelled) setLinkedTickets(page.items)
      })
      .catch((error) => {
        if (!cancelled) {
          setLinkedTickets([])
          setLinkedTicketsError(
            getApiErrorMessage(error, "Unable to load linked tickets."),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLinkedTicketsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeId, workspaceId])

  useEffect(() => {
    setItems([])
    setActiveId(null)
    void loadConversations()
  }, [loadConversations, workspaceId])

  const loadConversationDetail = useCallback(async (conversationId: string) => {
    setMessagesLoading(true)
    setMessagesError(null)
    setSendError(null)

    try {
      const [detail, messages] = await Promise.all([
        getConversation(conversationId),
        listConversationMessages(conversationId),
      ])

      const mappedMessages = messages.map(mapMessageFromApi)

      setItems((current) =>
        current.map((item) =>
          item.id === conversationId
            ? mapConversationFromApi(detail, mappedMessages)
            : item,
        ),
      )

      if (detail.unread_count > 0) {
        try {
          const cleared = await updateConversation(conversationId, {
            unread_count: 0,
          })
          setItems((current) =>
            current.map((item) =>
              item.id === conversationId
                ? mergeConversationUpdate(
                    {
                      ...item,
                      messages: mappedMessages,
                    },
                    cleared,
                  )
                : item,
            ),
          )
        } catch {
          // Non-blocking: message load succeeded even if unread clear failed.
        }
      }
    } catch (error) {
      setMessagesError(
        getApiErrorMessage(error, "Unable to load conversation messages."),
      )
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    void loadConversationDetail(activeId)
  }, [activeId, loadConversationDetail])

  const selectConversation = (id: string) => {
    setActiveId(id)
    setDraft("")
    setSendError(null)
    setMobileView("detail")
  }

  const openCreate = () => {
    setCreateValues(emptyNewConversationValues())
    setCreateError(null)
    setCreateOpen(true)
  }

  const closeCreate = () => {
    if (isCreating) return
    setCreateOpen(false)
    setCreateError(null)
    setCreateValues(emptyNewConversationValues())
  }

  const handleCreate = async () => {
    const validationError = validateNewConversationValues(createValues)
    if (validationError) {
      setCreateError(validationError)
      return
    }

    setIsCreating(true)
    setCreateError(null)
    try {
      const created = await createConversation(
        toConversationCreatePayload(createValues),
      )
      const mapped = mapConversationFromApi(created)
      setItems((current) => [
        mapped,
        ...current.filter((item) => item.id !== mapped.id),
      ])
      setFilter("inbox")
      setSearch("")
      setCreateOpen(false)
      setCreateValues(emptyNewConversationValues())
      selectConversation(mapped.id)
    } catch (error) {
      setCreateError(
        getApiErrorMessage(error, "Unable to create conversation."),
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleSend = async (value: string) => {
    if (!activeConversation) return

    setSending(true)
    setSendError(null)
    try {
      const created = await sendConversationMessage(activeConversation.id, {
        content: value,
        sender_type: "agent",
      })
      const mapped = mapMessageFromApi(created)

      setItems((current) =>
        current.map((item) =>
          item.id === activeConversation.id
            ? {
                ...item,
                lastMessage: mapped.content,
                time: formatRelativeTime(mapped.createdAt),
                updatedAt: mapped.createdAt,
                unread: 0,
                messages: [...item.messages, mapped],
              }
            : item,
        ),
      )
      setDraft("")
    } catch (error) {
      setSendError(getApiErrorMessage(error, "Unable to send message."))
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (status: ConversationStatus) => {
    if (!activeConversation || activeConversation.status === status) return

    setUpdatingStatus(true)
    try {
      const updated = await updateConversation(activeConversation.id, {
        status,
      })
      setItems((current) =>
        current.map((item) =>
          item.id === activeConversation.id
            ? {
                ...mergeConversationUpdate(item, updated),
                filterTags: statusToFilterTags(status),
                messages: item.messages,
              }
            : item,
        ),
      )
    } catch (error) {
      setSendError(
        getApiErrorMessage(error, "Unable to update conversation status."),
      )
    } finally {
      setUpdatingStatus(false)
    }
  }

  const openTicketCreate = () => {
    if (!activeConversation) return
    setTicketValues(ticketFormFromConversation(activeConversation))
    setTicketError(null)
    setTicketCreateOpen(true)
  }

  const closeTicketCreate = () => {
    if (isCreatingTicket) return
    setTicketCreateOpen(false)
    setTicketError(null)
    setTicketValues(emptyTicketFormValues())
  }

  const handleCreateTicket = async () => {
    const validationError = validateTicketForm(ticketValues)
    if (validationError) {
      setTicketError(validationError)
      return
    }
    setIsCreatingTicket(true)
    setTicketError(null)
    try {
      const created = await createTicket(toCreatePayload(ticketValues))
      setLinkedTickets((current) => [
        created,
        ...current.filter((item) => item.id !== created.id),
      ])
      setTicketCreateOpen(false)
      setTicketValues(emptyTicketFormValues())
    } catch (error) {
      setTicketError(getApiErrorMessage(error, "Unable to create ticket."))
    } finally {
      setIsCreatingTicket(false)
    }
  }

  const ticketConversationOptions: ConversationApi[] = activeConversation
    ? [
        {
          id: activeConversation.id,
          owner_id: "",
          customer_id: activeConversation.customerId ?? null,
          customer_name: activeConversation.customerName,
          customer_email: activeConversation.customerEmail,
          subject: activeConversation.subject,
          status: activeConversation.status,
          channel: activeConversation.channel,
          assigned_agent_id: null,
          unread_count: activeConversation.unread,
          last_message: activeConversation.lastMessage,
          created_at: activeConversation.updatedAt,
          updated_at: activeConversation.updatedAt,
        },
      ]
    : []

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border/70 bg-card px-3 py-2 2xl:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl xl:hidden"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="size-4" />
          Filters
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto rounded-xl"
          onClick={() => setAiOpen(true)}
          disabled={!activeConversation}
        >
          <PanelRightOpen className="size-4" />
          AI panel
        </Button>
      </div>

      {listError ? (
        <div className="flex items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          <span>{listError}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-lg"
            onClick={() => void loadConversations()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="hidden h-full w-60 shrink-0 xl:block 2xl:w-64">
          <ConversationFilters
            activeFilter={filter}
            search={search}
            counts={filterCounts}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            className="h-full"
          />
        </div>

        <div
          className={cn(
            "h-full w-full min-w-0 md:w-[22rem] lg:w-[24rem]",
            mobileView === "detail" && "hidden md:block",
          )}
        >
          <ConversationList
            conversations={filtered}
            activeId={activeConversation?.id ?? null}
            onSelect={selectConversation}
            onCreate={openCreate}
            isLoading={listLoading}
            error={listError}
            className="h-full"
          />
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1",
            mobileView === "list" && "hidden md:block",
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeConversation?.id ?? "empty"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="h-full min-h-0"
            >
              <ConversationDetail
                conversation={activeConversation}
                draft={draft}
                onDraftChange={setDraft}
                onSend={handleSend}
                onStatusChange={handleStatusChange}
                onBack={() => setMobileView("list")}
                isMessagesLoading={messagesLoading}
                messagesError={messagesError}
                sendError={sendError}
                isSending={sending}
                isUpdatingStatus={updatingStatus}
                linkedTickets={linkedTickets}
                linkedTicketsLoading={linkedTicketsLoading}
                linkedTicketsError={linkedTicketsError}
                onCreateTicket={
                  activeConversation ? openTicketCreate : undefined
                }
                className="h-full"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="hidden h-full w-80 shrink-0 2xl:block">
          <AiAssistantPanel
            conversation={activeConversation}
            onUseSuggestion={setDraft}
            onEscalate={openTicketCreate}
            className="h-full"
          />
        </div>
      </div>

      <Sheet
        open={createOpen}
        onOpenChange={(open) => {
          if (!open && !isCreating) {
            closeCreate()
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border/70 px-4 py-4 text-left">
            <SheetTitle>New conversation</SheetTitle>
          </SheetHeader>
          <NewConversationForm
            values={createValues}
            onChange={setCreateValues}
            onSubmit={() => void handleCreate()}
            onCancel={closeCreate}
            customers={customers}
            customersLoading={customersLoading}
            isSaving={isCreating}
            error={createError}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[min(100%,20rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversation filters</SheetTitle>
          </SheetHeader>
          <ConversationFilters
            activeFilter={filter}
            search={search}
            counts={filterCounts}
            onFilterChange={(next) => {
              setFilter(next)
              setFiltersOpen(false)
            }}
            onSearchChange={setSearch}
            className="h-full"
          />
        </SheetContent>
      </Sheet>

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent side="right" className="w-[min(100%,24rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>AI suggestions</SheetTitle>
          </SheetHeader>
          <AiAssistantPanel
            conversation={activeConversation}
            onUseSuggestion={(text) => {
              setDraft(text)
              setAiOpen(false)
            }}
            onEscalate={() => {
              openTicketCreate()
              setAiOpen(false)
            }}
            className="h-full"
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={ticketCreateOpen}
        onOpenChange={(open) => {
          if (!open && !isCreatingTicket) {
            closeTicketCreate()
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border/70 px-4 py-4 text-left">
            <SheetTitle>Create ticket</SheetTitle>
          </SheetHeader>
          <TicketForm
            values={ticketValues}
            onChange={setTicketValues}
            onSubmit={() => void handleCreateTicket()}
            onCancel={closeTicketCreate}
            submitLabel="Create ticket"
            customers={customers}
            customersLoading={customersLoading}
            conversations={ticketConversationOptions}
            members={members}
            membersLoading={membersLoading}
            isSaving={isCreatingTicket}
            error={ticketError}
            lockCustomer={Boolean(activeConversation?.customerId)}
            lockConversation
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
