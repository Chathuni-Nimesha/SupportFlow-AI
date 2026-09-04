import { useState } from "react"

import { useAuth } from "@/context/auth-provider"
import { TEAM_ROLE_LABELS } from "@/lib/team-mappers"
import { getApiErrorMessage } from "@/utils/api-error"

const selectClassName =
  "h-9 w-full rounded-xl border border-border/80 bg-background px-2.5 text-xs shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"

type WorkspaceSwitcherProps = {
  className?: string
}

export function WorkspaceSwitcher({ className }: WorkspaceSwitcherProps) {
  const { workspaces, currentWorkspace, selectWorkspace } = useAuth()
  const [isSwitching, setIsSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!currentWorkspace || workspaces.length === 0) {
    return null
  }

  const handleChange = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === currentWorkspace.id) return
    setIsSwitching(true)
    setError(null)
    try {
      await selectWorkspace(workspaceId)
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Unable to switch workspace."),
      )
    } finally {
      setIsSwitching(false)
    }
  }

  return (
    <div className={className}>
      <label htmlFor="workspace-switcher" className="sr-only">
        Workspace
      </label>
      <select
        id="workspace-switcher"
        aria-label="Workspace"
        value={currentWorkspace.id}
        disabled={isSwitching || workspaces.length < 2}
        onChange={(event) => void handleChange(event.target.value)}
        className={selectClassName}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name} · {TEAM_ROLE_LABELS[workspace.role]}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
