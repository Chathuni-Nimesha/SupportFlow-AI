import { useId } from "react"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchBarProps = {
  className?: string
  placeholder?: string
}

export function SearchBar({
  className,
  placeholder = "Global search is not available yet",
}: SearchBarProps) {
  const descriptionId = useId()

  return (
    <div className={cn("w-full max-w-md", className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value=""
          placeholder={placeholder}
          aria-label="Global search"
          aria-disabled="true"
          aria-describedby={descriptionId}
          disabled
          title="A unified search API is not connected yet."
          className="h-10 rounded-2xl border-border/80 bg-background pr-3 pl-9 text-sm shadow-none"
        />
      </div>
      <p
        id={descriptionId}
        className="mt-1 text-[11px] leading-relaxed text-muted-foreground lg:sr-only"
      >
        A unified search API is not connected yet.
      </p>
    </div>
  )
}
