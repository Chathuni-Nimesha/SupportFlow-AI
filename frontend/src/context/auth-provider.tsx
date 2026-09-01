import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { isAxiosError } from "axios"

import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "@/services/auth"
import type {
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from "@/types/auth"

const TOKEN_KEY = "access_token"

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (payload: LoginPayload) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function isUnauthorizedError(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 401
}

function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => getStoredToken())
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const stored = getStoredToken()
    if (!stored) {
      setUser(null)
      setToken(null)
      return
    }

    const current = await fetchCurrentUser()
    setUser(current)
    setToken(stored)
  }, [])

  useEffect(() => {
    let active = true

    async function bootstrap() {
      const stored = getStoredToken()
      if (!stored) {
        if (active) {
          setIsLoading(false)
        }
        return
      }

      try {
        const current = await fetchCurrentUser()
        if (active) {
          setUser(current)
          setToken(stored)
        }
      } catch (error) {
        if (isUnauthorizedError(error)) {
          clearStoredSession()
          if (active) {
            setUser(null)
            setToken(null)
          }
        } else if (active) {
          // Keep the token so Retry / refreshUser() can call /auth/me again.
          setUser(null)
          setToken(stored)
          console.error("Failed to restore auth session", error)
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    const clearSession = () => {
      setUser(null)
      setToken(null)
    }

    window.addEventListener("auth:logout", clearSession)
    void bootstrap()
    return () => {
      active = false
      window.removeEventListener("auth:logout", clearSession)
    }
  }, [])

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await loginUser(payload)
    localStorage.setItem(TOKEN_KEY, result.access_token)
    setToken(result.access_token)
    setUser(result.user)
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    await registerUser(payload)
    await login({
      email: payload.email,
      password: payload.password,
    })
  }, [login])

  const logout = useCallback(async () => {
    await logoutUser()
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, token, isLoading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
