import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/auth-provider"
import { TEAM_ROLE_LABELS } from "@/lib/team-mappers"
import { canManageWorkspace } from "@/lib/workspace-permissions"
import { updateWorkspace } from "@/services/workspaces"
import { getApiErrorMessage } from "@/utils/api-error"

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function WorkspaceCard() {
  const { user, isLoading, currentWorkspace, refreshUser } = useAuth()
  const canManage = !isLoading && canManageWorkspace(user)
  const [name, setName] = useState(currentWorkspace?.name ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(currentWorkspace?.name ?? "")
  }, [currentWorkspace?.id, currentWorkspace?.name])

  if (!currentWorkspace) {
    return null
  }

  const roleLabel = TEAM_ROLE_LABELS[currentWorkspace.role]
  const trimmedName = name.trim()
  const canSave =
    canManage &&
    trimmedName.length > 0 &&
    trimmedName !== currentWorkspace.name &&
    !isSaving

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    setError(null)
    try {
      await updateWorkspace(currentWorkspace.id, { name: trimmedName })
      await refreshUser()
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Unable to update the workspace."),
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Workspace</CardTitle>
            <CardDescription className="mt-1">
              Details from your current workspace. Switching workspaces is
              saved on the server and is not stored in the sign-in token.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="rounded-full">
            {roleLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {canManage ? (
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-2xl"
              disabled={isSaving}
            />
          </div>
        ) : (
          <ReadOnlyField label="Workspace name" value={currentWorkspace.name} />
        )}

        <ReadOnlyField label="Your role" value={roleLabel} />

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {canManage ? (
          <div className="flex justify-end">
            <Button
              type="button"
              className="rounded-2xl"
              onClick={() => void handleSave()}
              disabled={!canSave}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Save workspace
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
