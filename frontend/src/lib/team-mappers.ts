import type {
  AssignableTeamRole,
  TeamMember,
  TeamMemberCreatePayload,
  TeamMemberFormValues,
  TeamMemberRole,
  TeamMemberStatus,
  TeamMemberUpdatePayload,
} from "@/types/team"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const TEAM_ROLE_LABELS: Record<TeamMemberRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  AGENT: "Agent",
}

export const TEAM_STATUS_LABELS: Record<TeamMemberStatus, string> = {
  ACTIVE: "Active",
  INVITED: "Invited",
  DISABLED: "Disabled",
}

export function teamMemberDisplayName(member: {
  first_name: string
  last_name: string
}): string {
  return `${member.first_name} ${member.last_name}`.trim()
}

export function teamMemberInitials(member: {
  first_name: string
  last_name: string
}): string {
  const first = member.first_name.trim().charAt(0)
  const last = member.last_name.trim().charAt(0)
  return `${first}${last}`.toUpperCase() || "?"
}

export function formatTeamDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function emptyTeamFormValues(): TeamMemberFormValues {
  return {
    first_name: "",
    last_name: "",
    email: "",
    role: "AGENT",
    status: "ACTIVE",
  }
}

export function formValuesFromTeamMember(
  member: TeamMember,
): TeamMemberFormValues {
  const role: AssignableTeamRole =
    member.role === "OWNER" ? "ADMIN" : member.role
  return {
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    role,
    status: member.status,
  }
}

export function toCreatePayload(
  values: TeamMemberFormValues,
): TeamMemberCreatePayload {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim(),
    role: values.role,
    status: values.status,
  }
}

export function toUpdatePayload(
  values: TeamMemberFormValues,
): TeamMemberUpdatePayload {
  return toCreatePayload(values)
}

export function validateTeamForm(values: TeamMemberFormValues): string | null {
  if (!values.first_name.trim()) return "First name is required."
  if (!values.last_name.trim()) return "Last name is required."
  if (!values.email.trim()) return "Email is required."
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    return "Enter a valid email address."
  }
  return null
}

export function isWorkspaceOwner(member: TeamMember): boolean {
  return member.role === "OWNER"
}
