import type { AuthUser, AuthWorkspaceSummary } from "@/types/auth"

export type WorkspaceMemberRole = AuthWorkspaceSummary["role"]

const MANAGER_ROLES = new Set<WorkspaceMemberRole>(["OWNER", "ADMIN"])

export function currentWorkspace(
  user: AuthUser | null | undefined,
): AuthWorkspaceSummary | null {
  if (!user) return null
  const workspaceId = user.default_workspace_id
  return (
    user.workspaces?.find((workspace) => workspace.id === workspaceId) ??
    user.workspaces?.[0] ??
    null
  )
}

export function currentWorkspaceId(
  user: AuthUser | null | undefined,
): string | null {
  return currentWorkspace(user)?.id ?? user?.default_workspace_id ?? null
}

export function currentWorkspaceRole(
  user: AuthUser | null | undefined,
): WorkspaceMemberRole | null {
  return currentWorkspace(user)?.role ?? null
}

export function canManageWorkspace(user: AuthUser | null | undefined): boolean {
  const role = currentWorkspaceRole(user)
  if (role == null) return true
  return MANAGER_ROLES.has(role)
}

export function canManageTeam(user: AuthUser | null | undefined): boolean {
  return canManageWorkspace(user)
}

export function canManageKnowledge(user: AuthUser | null | undefined): boolean {
  return canManageWorkspace(user)
}
