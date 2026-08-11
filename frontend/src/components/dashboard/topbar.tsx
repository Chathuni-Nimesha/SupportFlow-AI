import { Menu } from "lucide-react"

import { DashboardBreadcrumb } from "@/components/dashboard/dashboard-breadcrumb"
import { NotificationMenu } from "@/components/dashboard/notification-menu"
import { SearchBar } from "@/components/dashboard/search-bar"
import { ThemeToggle } from "@/components/dashboard/theme-toggle"
import { UserMenu } from "@/components/dashboard/user-menu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type TopbarProps = {
  onOpenMobileNav: () => void
  className?: string
}

export function Topbar({ onOpenMobileNav, className }: TopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-xl lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" />
        </Button>

        <div className="hidden min-w-0 flex-1 md:block">
          <DashboardBreadcrumb />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <SearchBar className="hidden max-w-xs lg:block xl:max-w-md" />
          <ThemeToggle />
          <NotificationMenu />
          <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
          <UserMenu />
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-3 md:hidden">
        <DashboardBreadcrumb />
      </div>

      <div className="border-t border-border/60 px-4 py-3 lg:hidden">
        <SearchBar />
      </div>
    </header>
  )
}
