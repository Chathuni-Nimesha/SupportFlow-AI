import { useEffect, useState, type ReactNode } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { motion } from "framer-motion"

import { Sidebar } from "@/components/dashboard/sidebar"
import { Topbar } from "@/components/dashboard/topbar"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useAuth } from "@/context/auth-provider"
import { cn } from "@/lib/utils"

const COLLAPSE_KEY = "supportflow-sidebar-collapsed"

type DashboardLayoutProps = {
  children?: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation()
  const { currentWorkspace } = useAuth()
  const workspaceScopeKey = currentWorkspace?.id ?? "none"
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(COLLAPSE_KEY) === "true"
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, String(collapsed))
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const isFullBleed = location.pathname.startsWith("/dashboard/conversations")

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="flex min-h-svh">
        <div
          className={cn(
            "sticky top-0 hidden h-svh shrink-0 transition-[width] duration-300 ease-out lg:block",
            collapsed ? "w-[5.25rem]" : "w-72",
          )}
        >
          <Sidebar
            collapsed={collapsed}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar onOpenMobileNav={() => setMobileOpen(true)} />

          <main
            className={cn(
              "flex min-h-0 flex-1 flex-col",
              isFullBleed ? "overflow-hidden" : "px-4 py-6 sm:px-6 lg:px-8",
            )}
          >
            <motion.div
              key={`${workspaceScopeKey}:${location.pathname}`}
              initial={{ opacity: 0, y: isFullBleed ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "w-full",
                isFullBleed
                  ? "flex min-h-0 flex-1 flex-col"
                  : "mx-auto max-w-7xl",
              )}
            >
              {children ?? <Outlet />}
            </motion.div>
          </main>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="flex w-[min(100%,20rem)] flex-col p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar
            collapsed={false}
            onToggleCollapsed={() => undefined}
            onNavigate={() => setMobileOpen(false)}
            showCollapseControl={false}
            className="min-h-0 flex-1 border-r-0"
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
