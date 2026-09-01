import { useState } from "react"
import { Loader2 } from "lucide-react"
import { motion } from "framer-motion"

import { AccountCard } from "@/components/settings/account-card"
import { AppearanceCard } from "@/components/settings/appearance-card"
import { UnavailableSettings } from "@/components/settings/unavailable-settings"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-provider"
import { getApiErrorMessage } from "@/utils/api-error"

export function SettingsBoard() {
  const { user, isLoading, refreshUser } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const handleRetry = async () => {
    setIsRefreshing(true)
    setRefreshError(null)
    try {
      await refreshUser()
    } catch (error) {
      setRefreshError(
        getApiErrorMessage(error, "Unable to load your account."),
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  const showLoading = isLoading || isRefreshing
  const showError = !showLoading && !user

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Account information comes from your signed-in account. Advanced
          settings are not connected yet.
        </p>
      </motion.div>

      {showLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card px-6 py-16 text-sm text-muted-foreground shadow-soft">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading your account…
        </div>
      ) : null}

      {showError ? (
        <div className="rounded-2xl border border-border/70 bg-card px-6 py-12 text-center shadow-soft">
          <h2 className="text-lg font-semibold text-foreground">
            Couldn’t load your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {refreshError ??
              "Your account details are unavailable. Please try again."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5 rounded-2xl"
            onClick={() => void handleRetry()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!showLoading && user ? <AccountCard user={user} /> : null}

      <AppearanceCard />
      <UnavailableSettings />
    </div>
  )
}
