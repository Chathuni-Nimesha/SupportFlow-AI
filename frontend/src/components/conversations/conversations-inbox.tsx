import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PanelRightOpen, SlidersHorizontal } from "lucide-react"

import { AiAssistantPanel } from "@/components/conversations/ai-assistant-panel"
import { ConversationDetail } from "@/components/conversations/conversation-detail"
import { ConversationFilters } from "@/components/conversations/conversation-filters"
import { ConversationList } from "@/components/conversations/conversation-list"
import {
  conversations as conversationData,
  type Conversation,
  type ConversationFilter,
} from "@/data/conversations"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

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
      item.customerEmail.toLowerCase().includes(query)

    return matchesFilter && matchesSearch
  })
}

export function ConversationsInbox() {
  const [filter, setFilter] = useState<ConversationFilter>("inbox")
  const [search, setSearch] = useState("")
  const [items, setItems] = useState(conversationData)
  const [activeId, setActiveId] = useState(conversationData[0]?.id ?? null)
  const [draft, setDraft] = useState("")
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [escalated, setEscalated] = useState(false)

  const filtered = useMemo(
    () => filterConversations(items, filter, search),
    [items, filter, search],
  )

  const activeConversation =
    filtered.find((item) => item.id === activeId) ?? filtered[0] ?? null

  const selectConversation = (id: string) => {
    setActiveId(id)
    setDraft("")
    setEscalated(false)
    setMobileView("detail")
  }

  const handleSend = (value: string) => {
    if (!activeConversation) return

    const nextMessage = {
      id: `local-${Date.now()}`,
      sender: "agent" as const,
      content: value,
      timestamp: "Just now",
    }

    setItems((current) =>
      current.map((item) =>
        item.id === activeConversation.id
          ? {
              ...item,
              lastMessage: value,
              time: "Just now",
              unread: 0,
              messages: [...item.messages, nextMessage],
            }
          : item,
      ),
    )
    setDraft("")
  }

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

      {escalated ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          Escalation noted (UI only) — a human agent would be notified next.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="hidden h-full w-60 shrink-0 xl:block 2xl:w-64">
          <ConversationFilters
            activeFilter={filter}
            search={search}
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
                onBack={() => setMobileView("list")}
                className="h-full"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="hidden h-full w-80 shrink-0 2xl:block">
          <AiAssistantPanel
            conversation={activeConversation}
            onUseSuggestion={setDraft}
            onEscalate={() => setEscalated(true)}
            className="h-full"
          />
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[min(100%,20rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Conversation filters</SheetTitle>
          </SheetHeader>
          <ConversationFilters
            activeFilter={filter}
            search={search}
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
              setEscalated(true)
              setAiOpen(false)
            }}
            className="h-full"
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
