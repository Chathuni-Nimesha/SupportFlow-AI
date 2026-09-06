import { Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Bot, Plus, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-provider"
import { TEAM_ROLE_LABELS } from "@/lib/team-mappers"
import { canManageKnowledge } from "@/lib/workspace-permissions"

function formatToday() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date())
}

export function WelcomeHeader() {
  const { user, isLoading, currentWorkspace } = useAuth()
  const firstName = user?.first_name?.trim()
  const heading = firstName ? `Welcome back, ${firstName}` : "Welcome back"
  const canUploadDocs = !isLoading && canManageKnowledge(user)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-soft sm:flex-row sm:items-end sm:justify-between sm:p-6"
    >
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          {formatToday()}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {heading}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Review conversations, tickets, and knowledge in your workspace.
        </p>
        {currentWorkspace ? (
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            {currentWorkspace.name} · {TEAM_ROLE_LABELS[currentWorkspace.role]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-2xl shadow-soft" asChild>
          <Link to="/dashboard/conversations">
            <Plus className="size-4" />
            New conversation
          </Link>
        </Button>
        {canUploadDocs ? (
          <Button variant="outline" className="rounded-2xl bg-background" asChild>
            <Link to="/dashboard/knowledge-base">
              <Upload className="size-4" />
              Upload docs
            </Link>
          </Button>
        ) : null}
        <Button variant="secondary" className="rounded-2xl" asChild>
          <Link to="/dashboard/ai-assistant">
            <Bot className="size-4" />
            Open AI assistant
          </Link>
        </Button>
      </div>
    </motion.div>
  )
}
