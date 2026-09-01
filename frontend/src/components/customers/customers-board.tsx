import { Users } from "lucide-react"
import { motion } from "framer-motion"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const unavailableItems = [
  {
    label: "Customer directory",
    message: "There is no customers API to list customer records.",
  },
  {
    label: "Customer profiles",
    message: "There is no customer profile or history endpoint.",
  },
  {
    label: "Customer search",
    message: "Search and filters are unavailable until a customers backend exists.",
  },
]

export function CustomersBoard() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Customers
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          A dedicated customer management API is not connected yet.
        </p>
      </motion.div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-soft">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Users className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Not available
        </h2>
        <p className="mt-1 text-sm font-medium text-foreground">
          Customer management is not available yet.
        </p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          A dedicated customers backend is not currently connected. Customer
          information is currently stored only as part of conversations.
        </p>
      </div>

      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Customer management</CardTitle>
          <CardDescription className="mt-1">
            These capabilities are not backed by a customers API and are not
            estimated from conversation fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {unavailableItems.map((item) => (
              <li
                key={item.label}
                className="rounded-2xl border border-border/70 bg-background px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    Not available
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {item.message}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
