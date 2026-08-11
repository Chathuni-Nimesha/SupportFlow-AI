import { motion } from "framer-motion"
import { Link } from "react-router-dom"

import { recentConversations, type ConversationRow } from "@/data/dashboard-home"
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
import { cn } from "@/lib/utils"

const statusStyles: Record<ConversationRow["status"], string> = {
  Resolved:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Open: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  Pending:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Escalated:
    "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
}

export function RecentConversationsTable() {
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
              Latest customer threads across chat, email, and Slack.
            </CardDescription>
          </div>
          <Button variant="outline" className="rounded-2xl" asChild>
            <Link to="/dashboard/conversations">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
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
              {recentConversations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-5 font-medium">
                    <div>
                      <p className="text-foreground">{row.customer}</p>
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
                    {row.updatedAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
}
