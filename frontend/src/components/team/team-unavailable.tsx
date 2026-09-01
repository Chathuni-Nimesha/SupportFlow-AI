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
    label: "Member directory",
    message: "There is no team-member API to list other people in this workspace.",
  },
  {
    label: "Invitations",
    message: "There is no invitation API. Teammates cannot be invited from this page.",
  },
  {
    label: "Roles & permissions",
    message: "Roles and permissions are not stored or returned by the backend.",
  },
]

export function TeamUnavailable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Team management</CardTitle>
          <CardDescription className="mt-1">
            Team member management is not available yet.
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
    </motion.div>
  )
}
