import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, Loader2, MessageSquare } from "lucide-react"
import { motion } from "framer-motion"

import { ChannelBreakdown } from "@/components/analytics/channel-breakdown"
import {
  countByStatus,
  countPresentChannels,
} from "@/components/analytics/conversation-counts"
import { ConversationKpiCards } from "@/components/analytics/conversation-kpi-cards"
import { UnavailableAnalytics } from "@/components/analytics/unavailable-analytics"
import { Button } from "@/components/ui/button"
import { listConversations } from "@/services/conversations"
import type { ConversationApi } from "@/types/conversations"
import { getApiErrorMessage } from "@/utils/api-error"

export function AnalyticsBoard() {
  const [conversations, setConversations] = useState<ConversationApi[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConversations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listConversations()
      setConversations(data)
    } catch (loadError) {
      setConversations([])
      setError(
        getApiErrorMessage(loadError, "Unable to load conversation analytics."),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  const statusCounts = useMemo(
    () => countByStatus(conversations),
    [conversations],
  )
  const channelCounts = useMemo(
    () => countPresentChannels(conversations),
    [conversations],
  )

  const isEmpty = !isLoading && !error && conversations.length === 0

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Analytics
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Conversation metrics from your workspace. These counts come from
          existing conversations — not tickets or estimated rates.
        </p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card px-6 py-16 text-sm text-muted-foreground shadow-soft">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading conversation analytics…
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-border/70 bg-card px-6 py-12 text-center shadow-soft">
          <h2 className="text-lg font-semibold text-foreground">
            Couldn’t load analytics
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 rounded-2xl"
            onClick={() => void loadConversations()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!isLoading && !error ? (
        <>
          <ConversationKpiCards counts={statusCounts} />

          {isEmpty ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-soft">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageSquare className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                No conversations yet
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Conversation analytics will appear here after conversations exist
                in your workspace.
              </p>
            </div>
          ) : (
            <ChannelBreakdown channels={channelCounts} />
          )}
        </>
      ) : null}

      <UnavailableAnalytics />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="size-3.5" aria-hidden />
        Live figures are counted from your workspace conversations only.
      </p>
    </div>
  )
}
