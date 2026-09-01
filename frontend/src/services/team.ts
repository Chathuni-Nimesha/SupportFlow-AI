import { api } from "@/services/api"
import type {
  TeamMember,
  TeamMemberCreatePayload,
  TeamMemberListParams,
  TeamMemberUpdatePayload,
} from "@/types/team"

export async function listTeamMembers(
  params: TeamMemberListParams = {},
): Promise<TeamMember[]> {
  const query = params.query?.trim()
  const { data } = await api.get<TeamMember[]>("/team", {
    params: {
      q: query || undefined,
      role: params.role || undefined,
      status: params.status || undefined,
    },
  })
  return data
}

export async function getTeamMember(memberId: string): Promise<TeamMember> {
  const { data } = await api.get<TeamMember>(`/team/${memberId}`)
  return data
}

export async function createTeamMember(
  payload: TeamMemberCreatePayload,
): Promise<TeamMember> {
  const { data } = await api.post<TeamMember>("/team", payload)
  return data
}

export async function updateTeamMember(
  memberId: string,
  payload: TeamMemberUpdatePayload,
): Promise<TeamMember> {
  const { data } = await api.patch<TeamMember>(`/team/${memberId}`, payload)
  return data
}

export async function deleteTeamMember(memberId: string): Promise<void> {
  await api.delete(`/team/${memberId}`)
}
