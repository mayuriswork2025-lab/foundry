import { supabase } from "./supabase"

const API_URL = import.meta.env.VITE_API_URL

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ""}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export interface Startup {
  startupId: number
  startupName: string
  domain: string | null
  description: string | null
  registrationDate: string | null
  registrationStatus: string | null
  currentStage: string | null
  registeredBy: string | null
}

export interface StartupStageCount {
  currentStage: string | null
  startupCount: number
}

export interface StartupMilestoneInsight {
  startupId: number
  startupName: string
  milestoneCount: number
}

export interface StartupCreateInput {
  startupName: string
  domain?: string
  description?: string
  currentStage?: string
}

export interface StartupUpdateInput {
  startupName?: string
  domain?: string
  description?: string
  registrationStatus?: string
  currentStage?: string
}

export const api = {
  listStartups: () => request<Startup[]>("/api/startups"),
  createStartup: (payload: StartupCreateInput) =>
    request<Startup>("/api/startups", { method: "POST", body: JSON.stringify(payload) }),
  updateStartup: (startupId: number, payload: StartupUpdateInput) =>
    request<Startup>(`/api/startups/${startupId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteStartup: (startupId: number) =>
    request<void>(`/api/startups/${startupId}`, { method: "DELETE" }),
  getStageCounts: () => request<StartupStageCount[]>("/api/startups/stats"),
  getAboveAverageMilestoneStartups: () =>
    request<StartupMilestoneInsight[]>("/api/startups/insights/above-average-milestones"),
}
