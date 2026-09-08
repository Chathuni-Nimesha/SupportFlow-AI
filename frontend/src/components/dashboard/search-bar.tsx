import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  BookOpen,
  Loader2,
  MessageSquare,
  Search,
  Ticket,
  Users,
  X,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  countGlobalSearchHits,
  globalSearch,
} from "@/services/search"
import type {
  GlobalSearchHit,
  GlobalSearchResourceType,
  GlobalSearchResponse,
} from "@/types/search"
import { getApiErrorMessage } from "@/utils/api-error"

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

const GROUP_ORDER: Array<{
  key: keyof Pick<
    GlobalSearchResponse,
    "conversations" | "tickets" | "customers" | "knowledge"
  >
  label: string
  type: GlobalSearchResourceType
}> = [
  { key: "conversations", label: "Conversations", type: "conversation" },
  { key: "tickets", label: "Tickets", type: "ticket" },
  { key: "customers", label: "Customers", type: "customer" },
  { key: "knowledge", label: "Knowledge", type: "knowledge" },
]

const TYPE_ICON: Record<
  GlobalSearchResourceType,
  typeof MessageSquare
> = {
  conversation: MessageSquare,
  ticket: Ticket,
  customer: Users,
  knowledge: BookOpen,
}

type SearchBarProps = {
  className?: string
  placeholder?: string
}

export function SearchBar({
  className,
  placeholder = "Search...",
}: SearchBarProps) {
  const navigate = useNavigate()
  const listboxId = useId()
  const descriptionId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [query])

  const canSearch = debouncedQuery.length >= MIN_QUERY_LENGTH

  const searchQuery = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: () => globalSearch({ query: debouncedQuery }),
    enabled: canSearch && open,
    staleTime: 15_000,
  })

  const flatHits: GlobalSearchHit[] = canSearch && searchQuery.data
    ? GROUP_ORDER.flatMap((group) => searchQuery.data[group.key])
    : []

  useEffect(() => {
    setActiveIndex(-1)
  }, [debouncedQuery, searchQuery.dataUpdatedAt])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  const showPanel =
    open && (query.trim().length > 0 || Boolean(searchQuery.data))

  function selectHit(hit: GlobalSearchHit) {
    setOpen(false)
    setQuery("")
    setDebouncedQuery("")
    navigate(hit.href)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!showPanel || flatHits.length === 0) {
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) =>
        current < flatHits.length - 1 ? current + 1 : 0,
      )
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) =>
        current > 0 ? current - 1 : flatHits.length - 1,
      )
      return
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      selectHit(flatHits[activeIndex])
    }
  }

  const totalHits =
    searchQuery.data != null ? countGlobalSearchHits(searchQuery.data) : 0
  const showNoResults =
    canSearch &&
    !searchQuery.isFetching &&
    searchQuery.isSuccess &&
    totalHits === 0
  const showTooShort =
    open &&
    query.trim().length > 0 &&
    query.trim().length < MIN_QUERY_LENGTH &&
    !searchQuery.isFetching

  let optionIndex = -1

  return (
    <div ref={rootRef} className={cn("relative w-full max-w-md", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          aria-label="Global search"
          aria-describedby={descriptionId}
          aria-controls={listboxId}
          aria-expanded={showPanel}
          aria-autocomplete="list"
          role="combobox"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          className="h-10 rounded-2xl border-border/80 bg-background pr-9 pl-9 text-sm shadow-none"
        />
        {query ? (
          <button
            type="button"
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
            onClick={() => {
              setQuery("")
              setDebouncedQuery("")
              setOpen(false)
              inputRef.current?.focus()
            }}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <p id={descriptionId} className="sr-only">
        Search conversations, tickets, customers, and knowledge in this
        workspace. Use arrow keys to move through results and Enter to open.
      </p>

      {showPanel ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search results"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-border/80 bg-popover p-2 text-popover-foreground shadow-lg"
        >
          {searchQuery.isFetching ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Searching…
            </div>
          ) : null}

          {showTooShort ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Type at least {MIN_QUERY_LENGTH} characters to search.
            </p>
          ) : null}

          {searchQuery.isError ? (
            <p className="px-3 py-3 text-sm text-destructive" role="alert">
              {getApiErrorMessage(
                searchQuery.error,
                "Unable to search right now.",
              )}
            </p>
          ) : null}

          {showNoResults ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No results found
            </p>
          ) : null}

          {canSearch && searchQuery.data
            ? GROUP_ORDER.map((group) => {
                const items = searchQuery.data[group.key]
                if (items.length === 0) return null
                const Icon = TYPE_ICON[group.type]
                return (
                  <div key={group.key} className="mb-1 last:mb-0">
                    <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {items.map((hit) => {
                        optionIndex += 1
                        const index = optionIndex
                        const active = index === activeIndex
                        return (
                          <li key={`${hit.type}-${hit.id}`}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={cn(
                                "flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors",
                                active
                                  ? "bg-accent text-accent-foreground"
                                  : "hover:bg-muted/80",
                              )}
                              onMouseEnter={() => setActiveIndex(index)}
                              onClick={() => selectHit(hit)}
                            >
                              <Icon
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                  {hit.title}
                                </span>
                                {hit.subtitle ? (
                                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {hit.subtitle}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })
            : null}
        </div>
      ) : null}
    </div>
  )
}
