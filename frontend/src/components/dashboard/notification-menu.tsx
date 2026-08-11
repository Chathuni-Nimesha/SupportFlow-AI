import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const notifications = [
  {
    id: "1",
    title: "New VIP conversation",
    description: "Acme Corp requested a billing review.",
    time: "2m ago",
  },
  {
    id: "2",
    title: "Knowledge base sync complete",
    description: "48 articles updated successfully.",
    time: "1h ago",
  },
  {
    id: "3",
    title: "CSAT dipped slightly",
    description: "Yesterday’s score was 4.6 — review AI replies.",
    time: "3h ago",
  },
]

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
          className={cn("relative rounded-xl", className)}
          aria-label="Open notifications"
        >
          <Bell className="size-4" />
          <span className="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-card" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl p-0">
        <DropdownMenuLabel className="px-4 py-3 text-sm font-semibold">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.map((item) => (
          <DropdownMenuItem
            key={item.id}
            className="cursor-pointer items-start gap-0 rounded-none px-4 py-3"
          >
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {item.description}
              </p>
              <p className="text-[11px] text-muted-foreground">{item.time}</p>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="justify-center rounded-none py-3 text-sm font-medium text-primary">
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
