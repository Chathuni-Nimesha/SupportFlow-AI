import {
  Bot,
  Inbox,
  CircleDot,
  Clock3,
  Archive,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  conversationFilters,
  type ConversationFilter,
} from "@/data/conversations"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const filterIcons: Record<ConversationFilter, LucideIcon> = {
  inbox: Inbox,
  open: CircleDot,
  waiting: Clock3,
  closed: Archive,
  "ai-resolved": Sparkles,
}

type ConversationFiltersProps = {
  activeFilter: ConversationFilter
  search: string
  onFilterChange: (filter: ConversationFilter) => void
  onSearchChange: (value: string) => void
  className?: string
}

export function ConversationFilters({
  activeFilter,
  search,
  onFilterChange,
  onSearchChange,
  className,
}: ConversationFiltersProps) {
  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-border/80 bg-card",
        className,
      )}
    >
      <div className="space-y-3 border-b border-border/70 p-4">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Inbox</p>
            <p className="text-xs text-muted-foreground">SupportFlow AI</p>
          </div>
        </div>
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          className="h-10 rounded-2xl bg-background"
        />
      </div>

      <div className="p-3">
        <p className="mb-2 px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Filters
        </p>
        <nav aria-label="Conversation filters" className="space-y-1">
          {conversationFilters.map((filter) => {
            const Icon = filterIcons[filter.id]
            const active = activeFilter === filter.id
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => onFilterChange(filter.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{filter.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    active
                      ? "bg-white/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {filter.count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
