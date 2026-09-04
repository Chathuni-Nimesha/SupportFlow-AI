import type { AuthWorkspaceSummary } from "@/types/auth"

export type WorkspaceDetail = {
  id: string
  name: string
  owner_user_id: string
  created_at: string
  updated_at: string
  role: AuthWorkspaceSummary["role"]
}

export type WorkspaceUpdatePayload = {
  name: string
}
