import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Bot,
  BookOpen,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Ticket,
  Users,
  UsersRound,
} from "lucide-react"

export type DashboardNavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const dashboardNavItems: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { label: "Tickets", href: "/dashboard/tickets", icon: Ticket },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Knowledge Base", href: "/dashboard/knowledge-base", icon: BookOpen },
  { label: "AI Assistant", href: "/dashboard/ai-assistant", icon: Bot },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Team", href: "/dashboard/team", icon: UsersRound },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function getDashboardNavLabel(pathname: string): string {
  const exact = dashboardNavItems.find((item) => item.href === pathname)
  if (exact) return exact.label

  const nested = dashboardNavItems
    .filter((item) => item.href !== "/dashboard")
    .find((item) => pathname.startsWith(item.href))

  return nested?.label ?? "Dashboard"
}
