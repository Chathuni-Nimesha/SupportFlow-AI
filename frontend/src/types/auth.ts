export type AuthWorkspaceSummary = {
  id: string
  name: string
  role: "OWNER" | "ADMIN" | "AGENT"
}

export type AuthUser = {
  id: string
  first_name: string
  last_name: string
  company_name: string
  email: string
  is_active: boolean
  created_at: string
  default_workspace_id?: string | null
  workspaces?: AuthWorkspaceSummary[]
}

export type AuthTokenResponse = {
  access_token: string
  token_type: string
  user: AuthUser
}

export type RegisterPayload = {
  first_name: string
  last_name: string
  company_name: string
  email: string
  password: string
}

export type LoginPayload = {
  email: string
  password: string
}
