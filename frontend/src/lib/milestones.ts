import { apiFetch } from "@/lib/api"

export interface Milestone {
  milestoneId: number
  startupId: number
  milestoneName: string
  dueDate: string | null
  completionDate: string | null
  status: "pending" | "in_progress" | "completed" | null
  verificationStatus: "unverified" | "verified" | "rejected" | null
  mentorRemarks: string | null
}

export function listMilestones(startupId: number) {
  return apiFetch<Milestone[]>(`/api/startups/${startupId}/milestones`)
}

export function createMilestone(startupId: number, payload: { milestoneName: string; dueDate?: string | null }) {
  return apiFetch<Milestone>(`/api/startups/${startupId}/milestones`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateMilestoneStatus(startupId: number, milestoneId: number, status: "in_progress" | "completed") {
  return apiFetch<Milestone>(`/api/startups/${startupId}/milestones/${milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
}

export function verifyMilestone(
  startupId: number,
  milestoneId: number,
  payload: { verificationStatus: "verified" | "rejected"; remarks?: string | null },
) {
  return apiFetch<Milestone>(`/api/startups/${startupId}/milestones/${milestoneId}/verify`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function reopenMilestone(startupId: number, milestoneId: number) {
  return apiFetch<Milestone>(`/api/startups/${startupId}/milestones/${milestoneId}/reopen`, { method: "PATCH" })
}

export interface MilestoneNotification extends Milestone {
  startupName: string
}

export function listMilestoneNotifications() {
  return apiFetch<MilestoneNotification[]>("/api/milestones/notifications")
}
