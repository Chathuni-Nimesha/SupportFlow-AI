import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchBarProps = {
  className?: string
  placeholder?: string
}

export function SearchBar({
  className,
  placeholder = "Search conversations, tickets, customers…",
}: SearchBarProps) {
  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        placeholder={placeholder}
        aria-label="Search"
        className="h-10 rounded-2xl border-border/80 bg-background pr-3 pl-9 text-sm shadow-none"
      />
    </div>
  )
}
