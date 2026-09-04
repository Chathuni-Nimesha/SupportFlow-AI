export const TEAM_MEMBER_ROLES = ["OWNER", "ADMIN", "AGENT"] as const
export const TEAM_MEMBER_STATUSES = ["ACTIVE", "INVITED", "DISABLED"] as const
export const ASSIGNABLE_TEAM_ROLES = ["ADMIN", "AGENT"] as const

export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number]
export type TeamMemberStatus = (typeof TEAM_MEMBER_STATUSES)[number]
export type AssignableTeamRole = (typeof ASSIGNABLE_TEAM_ROLES)[number]

export type TeamMember = {
  id: string
  owner_id: string
  workspace_id?: string
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  role: TeamMemberRole
  status: TeamMemberStatus
  created_at: string
  updated_at: string
}

export type TeamMemberCreatePayload = {
  first_name: string
  last_name: string
  email: string
  role?: AssignableTeamRole
  status?: TeamMemberStatus
}

export type TeamMemberUpdatePayload = {
  first_name?: string
  last_name?: string
  email?: string
  role?: AssignableTeamRole
  status?: TeamMemberStatus
}

export type TeamMemberListParams = {
  query?: string
  role?: TeamMemberRole
  status?: TeamMemberStatus
  page?: number
  pageSize?: number
}

export type TeamMemberFormValues = {
  first_name: string
  last_name: string
  email: string
  role: AssignableTeamRole
  status: TeamMemberStatus
}
