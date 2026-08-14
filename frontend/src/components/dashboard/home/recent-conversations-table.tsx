import { Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"

import { UnavailablePanel } from "@/components/dashboard/home/unavailable-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRelativeTime } from "@/lib/conversation-mappers"
import { cn } from "@/lib/utils"
import type { ConversationApi, ConversationStatus } from "@/types/conversations"

const statusStyles: Record<ConversationStatus, string> = {
  Open: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  Waiting:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Closed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  "AI Resolved":
    "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
}

type RecentConversationsTableProps = {
  conversations: ConversationApi[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function RecentConversationsTable({
  conversations,
  isLoading = false,
  error = null,
  onRetry,
}: RecentConversationsTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <CardTitle className="text-lg">Recent Conversations</CardTitle>
            <CardDescription className="mt-1">
              Latest customer threads from your workspace.
            </CardDescription>
          </div>
          <Button variant="outline" className="rounded-2xl" asChild>
            <Link to="/dashboard/conversations">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading conversations…
            </div>
          ) : error ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Couldn’t load conversations
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              {onRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-xl"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          ) : conversations.length === 0 ? (
            <UnavailablePanel
              title="No conversations yet"
              message="Create a conversation to see recent threads here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5">Customer</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="px-5 text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="px-5 font-medium">
                      <div>
                        <p className="text-foreground">{row.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.channel}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      {row.subject}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-full border-0 font-medium",
                          statusStyles[row.status],
                        )}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 text-right text-muted-foreground">
                      {formatRelativeTime(row.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
