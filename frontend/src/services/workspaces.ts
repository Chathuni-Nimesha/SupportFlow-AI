import { api } from "@/services/api"
import type {
  WorkspaceDetail,
  WorkspaceUpdatePayload,
} from "@/types/workspace"

export async function updateWorkspace(
  workspaceId: string,
  payload: WorkspaceUpdatePayload,
): Promise<WorkspaceDetail> {
  const { data } = await api.patch<WorkspaceDetail>(
    `/workspaces/${workspaceId}`,
    payload,
  )
  return data
}

export async function selectWorkspace(
  workspaceId: string,
): Promise<WorkspaceDetail> {
  const { data } = await api.post<WorkspaceDetail>(
    `/workspaces/${workspaceId}/select`,
  )
  return data
}
