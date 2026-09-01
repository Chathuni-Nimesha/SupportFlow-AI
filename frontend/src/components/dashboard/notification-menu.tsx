import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type NotificationMenuProps = {
  className?: string
}

export function NotificationMenu({ className }: NotificationMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("rounded-xl", className)}
          aria-label="Open notifications"
        >
          <Bell className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl p-0">
        <DropdownMenuLabel className="px-4 py-3 text-sm font-semibold">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No notifications yet
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Notifications are not connected to a backend yet.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
