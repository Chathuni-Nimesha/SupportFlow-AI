import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { BrandLogo } from "@/components/common/brand-logo"
import { dashboardNavItems } from "@/components/dashboard/nav-config"
import { SidebarItem } from "@/components/dashboard/sidebar-item"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type SidebarProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
  onNavigate?: () => void
  className?: string
  showCollapseControl?: boolean
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
  className,
  showCollapseControl = true,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border/80 bg-card",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-2 px-3",
          collapsed ? "justify-center" : "justify-between px-4",
        )}
      >
        <BrandLogo
          to="/dashboard"
          showWordmark={!collapsed}
          className={cn(collapsed && "gap-0")}
          markClassName="size-9"
        />
        {showCollapseControl && !collapsed ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </Button>
        ) : null}
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3 py-4">
        <nav aria-label="Dashboard" className="space-y-1">
          {dashboardNavItems.map((item) => (
            <SidebarItem
              key={item.href}
              {...item}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </ScrollArea>

      {showCollapseControl && collapsed ? (
        <div className="border-t border-border/80 p-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="w-full rounded-xl"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="border-t border-border/80 p-4">
          {!collapsed ? (
            <div className="rounded-2xl bg-primary/5 p-3">
              <p className="text-xs font-semibold text-foreground">
                AI workspace
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Monitor conversations and train your agent from one place.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </aside>
  )
}
