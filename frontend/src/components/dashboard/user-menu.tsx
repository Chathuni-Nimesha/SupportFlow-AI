import { Link, useNavigate } from "react-router-dom"
import { LogOut, Settings, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/context/auth-provider"
import { TEAM_ROLE_LABELS } from "@/lib/team-mappers"
import { cn } from "@/lib/utils"

type UserMenuProps = {
  className?: string
}

export function UserMenu({ className }: UserMenuProps) {
  const { user, currentWorkspace, logout } = useAuth()
  const navigate = useNavigate()

  const name = user
    ? `${user.first_name} ${user.last_name}`.trim()
    : "SupportFlow User"
  const email = user?.email ?? ""
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const handleLogout = async () => {
    await logout()
    navigate("/login", { replace: true })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-10 gap-2 rounded-2xl px-2 hover:bg-muted",
            className,
          )}
          aria-label="Open user menu"
        >
          <Avatar size="sm" className="rounded-xl">
            <AvatarFallback className="rounded-xl bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[8rem] truncate text-left text-sm font-medium md:block">
            {name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">{name}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
            {currentWorkspace ? (
              <span className="text-xs text-muted-foreground">
                {currentWorkspace.name} ·{" "}
                {TEAM_ROLE_LABELS[currentWorkspace.role]}
              </span>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/dashboard/settings">
            <UserRound className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl">
          <Link to="/dashboard/settings">
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="rounded-xl text-destructive focus:text-destructive"
          onClick={() => void handleLogout()}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
