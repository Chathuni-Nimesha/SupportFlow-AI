import type { ReactElement, ReactNode } from "react"
import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, type RenderOptions } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/context/auth-provider"
import { ThemeProvider } from "@/context/theme-provider"

type ProvidersProps = {
  children: ReactNode
  initialEntries?: string[]
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: 0 },
    },
  })
}

export function AppTestProviders({
  children,
  initialEntries = ["/"],
}: ProvidersProps) {
  const [queryClient] = useState(createTestQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter initialEntries={initialEntries}>
            <AuthProvider>{children}</AuthProvider>
          </MemoryRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
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
