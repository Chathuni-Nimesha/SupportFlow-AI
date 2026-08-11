import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type AuthDividerProps = {
  label?: string
  className?: string
}

export function AuthDivider({
  label = "or continue with",
  className,
}: AuthDividerProps) {
  return (
    <div className={cn("flex items-center gap-3", className)} role="separator">
      <Separator className="flex-1" />
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Separator className="flex-1" />
    </div>
  )
}
