import type { ReactElement, ReactNode } from "react"
import { render, type RenderOptions } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/context/auth-provider"
import { ThemeProvider } from "@/context/theme-provider"

type ProvidersProps = {
  children: ReactNode
  initialEntries?: string[]
}

export function AppTestProviders({
  children,
  initialEntries = ["/"],
}: ProvidersProps) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>{children}</AuthProvider>
        </MemoryRouter>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { initialEntries?: string[] },
) {
  const { initialEntries, ...renderOptions } = options ?? {}

  return render(ui, {
    wrapper: ({ children }) => (
      <AppTestProviders initialEntries={initialEntries}>
        {children}
      </AppTestProviders>
    ),
    ...renderOptions,
  })
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
