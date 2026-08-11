import type { ReactNode } from "react"

import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { BrandLogo } from "@/components/common/brand-logo"
import { cn } from "@/lib/utils"

type AuthShellProps = {
  children: ReactNode
  footer?: ReactNode
  formMaxWidthClassName?: string
}

export function AuthShell({
  children,
  footer,
  formMaxWidthClassName = "max-w-md",
}: AuthShellProps) {
  return (
    <div className="min-h-svh bg-background text-foreground lg:grid lg:grid-cols-2">
      <section className="relative flex min-h-svh flex-col px-4 py-8 sm:px-8 lg:px-12 xl:px-16">
        <div className="pointer-events-none absolute inset-0 bg-mesh opacity-70 lg:opacity-40" />
        <div
          className={cn(
            "relative z-10 mx-auto flex w-full flex-1 flex-col",
            formMaxWidthClassName,
          )}
        >
          <BrandLogo className="mb-8 sm:mb-10" />
          <div className="flex flex-1 items-center py-2">{children}</div>
          {footer ? (
            <div className="mt-8 text-center text-xs text-muted-foreground sm:text-left">
              {footer}
            </div>
          ) : null}
        </div>
      </section>

      <AuthVisualPanel />
    </div>
  )
}
