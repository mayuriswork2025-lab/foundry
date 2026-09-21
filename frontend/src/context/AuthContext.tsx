import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { apiFetch, clearToken, getToken, setToken } from "@/lib/api"

export interface UserProfile {
  userId: string
  firstName: string
  lastName: string
  email: string
  roleName: string
  status: string
}

interface AuthResponse {
  accessToken: string
  user: UserProfile
}

export interface SignupPayload {
  email: string
  password: string
  firstName: string
  lastName: string
  role: "founder" | "mentor"
  phone?: string
  department?: string
}

interface AuthContextValue {
  profile: UserProfile | null
  loading: boolean
  signup: (payload: SignupPayload) => Promise<UserProfile>
  login: (email: string, password: string) => Promise<UserProfile>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    apiFetch<UserProfile>("/api/auth/me")
      .then(setProfile)
      .catch(() => clearToken())
      .finally(() => setLoading(false))
  }, [])

  const signup = async (payload: SignupPayload) => {
    const data = await apiFetch<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    setToken(data.accessToken)
    setProfile(data.user)
    return data.user
  }

  const login = async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
    setToken(data.accessToken)
    setProfile(data.user)
    return data.user
  }

  const signOut = () => {
    clearToken()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ profile, loading, signup, login, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
