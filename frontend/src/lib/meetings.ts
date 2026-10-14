import { apiFetch } from "@/lib/api"

export interface ActionItem {
  actionItemId: number
  meetingId: number
  itemText: string
  isDone: boolean
  createdAt: string
}

export interface Comment {
  commentId: number
  meetingId: number
  userId: string
  authorFirstName: string
  authorLastName: string
  body: string
  createdAt: string
}

export interface Meeting {
  meetingId: number
  milestoneId: number
  scheduledBy: string
  scheduledAt: string
  agenda: string | null
  discussion: string | null
  status: "scheduled" | "completed" | "cancelled"
  createdAt: string
  updatedAt: string
  actionItems: ActionItem[]
  comments: Comment[]
}

export function listMeetings(milestoneId: number) {
  return apiFetch<Meeting[]>(`/api/milestones/${milestoneId}/meetings`)
}

export function createMeeting(milestoneId: number, payload: { scheduledAt: string; agenda?: string | null }) {
  return apiFetch<Meeting>(`/api/milestones/${milestoneId}/meetings`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function updateMeeting(
  milestoneId: number,
  meetingId: number,
  payload: Partial<{
    scheduledAt: string
    agenda: string | null
    discussion: string | null
    status: "scheduled" | "completed" | "cancelled"
  }>,
) {
  return apiFetch<Meeting>(`/api/milestones/${milestoneId}/meetings/${meetingId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function addActionItem(milestoneId: number, meetingId: number, itemText: string) {
  return apiFetch<ActionItem>(`/api/milestones/${milestoneId}/meetings/${meetingId}/action-items`, {
    method: "POST",
    body: JSON.stringify({ itemText }),
  })
}

export function updateActionItem(milestoneId: number, meetingId: number, actionItemId: number, isDone: boolean) {
  return apiFetch<ActionItem>(`/api/milestones/${milestoneId}/meetings/${meetingId}/action-items/${actionItemId}`, {
    method: "PATCH",
    body: JSON.stringify({ isDone }),
  })
}

export function addComment(milestoneId: number, meetingId: number, body: string) {
  return apiFetch<Comment>(`/api/milestones/${milestoneId}/meetings/${meetingId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  })
}
