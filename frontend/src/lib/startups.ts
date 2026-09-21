import { apiFetch } from "@/lib/api"

export interface Startup {
  startupId: number
  startupName: string
  domain: string | null
  description: string | null
  registrationDate: string | null
  registrationStatus: "draft" | "pending" | "approved" | "rejected" | null
  submittedAt: string | null
  currentStage: string | null
  registeredBy: string | null
  memberStatus: "invited" | "accepted" | null
}

export interface Membership {
  membershipId: number
  startupId: number
  userId: string
  firstName: string
  lastName: string
  email: string
  projectRole: string
  status: "invited" | "accepted"
  joinDate: string | null
}

export function listStartups() {
  return apiFetch<Startup[]>("/api/startups")
}

export function createStartup(payload: { startupName: string; domain?: string | null; description?: string | null }) {
  return apiFetch<Startup>("/api/startups", { method: "POST", body: JSON.stringify(payload) })
}

export function updateStartup(
  startupId: number,
  payload: { startupName: string; domain?: string | null; description?: string | null },
) {
  return apiFetch<Startup>(`/api/startups/${startupId}`, { method: "PATCH", body: JSON.stringify(payload) })
}

export function submitStartup(startupId: number) {
  return apiFetch<Startup>(`/api/startups/${startupId}/submit`, { method: "PATCH" })
}

export function approveStartup(startupId: number) {
  return apiFetch<Startup>(`/api/startups/${startupId}/approve`, { method: "PATCH" })
}

export function listGuidingStartups() {
  return apiFetch<Startup[]>("/api/startups/guiding")
}

export function listMembers(startupId: number) {
  return apiFetch<Membership[]>(`/api/startups/${startupId}/members`)
}

export function inviteMember(startupId: number, email: string) {
  return apiFetch<Membership>(`/api/startups/${startupId}/members`, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export function acceptInvite(startupId: number) {
  return apiFetch<Membership>(`/api/startups/${startupId}/members/accept`, { method: "POST" })
}

export interface UserSummary {
  userId: string
  firstName: string
  lastName: string
  email: string
}

export function searchFounders(q: string) {
  return apiFetch<UserSummary[]>(`/api/users/search?q=${encodeURIComponent(q)}`)
}
