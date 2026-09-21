import { apiFetch } from "@/lib/api"

export const MAX_MENTOR_TARGETS = 3

export interface MentorRequest {
  mentorRequestId: number
  startupId: number
  requestedBy: string
  requiredSkills: string | null
  requestDescription: string | null
  status: "pending" | "approved" | "rejected"
  decidedBy: string | null
  decisionDate: string | null
  remarks: string | null
  createdAt: string
  mentorIds: string[]
  startupName: string
  requesterFirstName: string
  requesterLastName: string
}

export function listMentors() {
  return apiFetch<{ userId: string; firstName: string; lastName: string; email: string; department: string | null }[]>(
    "/api/users/mentors",
  )
}

export function createMentorRequest(
  startupId: number,
  payload: { requiredSkills?: string | null; requestDescription?: string | null; mentorIds?: string[] },
) {
  return apiFetch<MentorRequest>(`/api/startups/${startupId}/mentor-requests`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function listInbox() {
  return apiFetch<MentorRequest[]>("/api/mentor-requests/inbox")
}

export function approveMentorRequest(requestId: number) {
  return apiFetch<MentorRequest>(`/api/mentor-requests/${requestId}/approve`, { method: "PATCH" })
}

export function rejectMentorRequest(requestId: number, remarks?: string) {
  return apiFetch<MentorRequest>(`/api/mentor-requests/${requestId}/reject`, {
    method: "PATCH",
    body: JSON.stringify({ remarks: remarks || null }),
  })
}
