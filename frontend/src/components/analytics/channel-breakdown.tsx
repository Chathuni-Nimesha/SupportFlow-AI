import { Hash, Mail, MessageSquare } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { motion } from "framer-motion"

import type { ChannelCount } from "@/components/analytics/conversation-counts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ConversationChannel } from "@/types/conversations"

const channelIcons: Record<ConversationChannel, LucideIcon> = {
  Chat: MessageSquare,
  Email: Mail,
  Slack: Hash,
}

type ChannelBreakdownProps = {
  channels: ChannelCount[]
}

export function ChannelBreakdown({ channels }: ChannelBreakdownProps) {
  if (channels.length === 0) {
    return null
  }

  const maxCount = Math.max(...channels.map((item) => item.count))

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Channel breakdown</CardTitle>
          <CardDescription className="mt-1">
            Conversation counts by channel. Only channels present in your
            workspace are shown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {channels.map((item) => {
            const Icon = channelIcons[item.channel]
            const widthPercent =
              maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0

            return (
              <div key={item.channel} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {item.channel}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {item.count.toLocaleString()}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </motion.div>
  )
}
