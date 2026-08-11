import { api } from "@/services/api"
import type {
  AuthTokenResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth"

export async function registerUser(payload: RegisterPayload): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>("/auth/register", payload)
  return data
}

export async function loginUser(
  payload: LoginPayload,
): Promise<AuthTokenResponse> {
  const { data } = await api.post<AuthTokenResponse>("/auth/login", payload)
  return data
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>("/auth/me")
  return data
}

export async function logoutUser(): Promise<void> {
  try {
    await api.post("/auth/logout")
  } catch {
    // Stateless JWT logout still clears local state even if the call fails.
  }
}
