import { apiFetch } from "@/lib/api"

export interface JudgeSummary {
  mentorId: string
  firstName: string
  lastName: string
}

export interface DemoDay {
  demoDayId: number
  eventName: string
  eventDate: string
  venue: string | null
  theme: string | null
  kind: "monthly" | "special"
  judges: JudgeSummary[]
  amJudging: boolean
  assignedJudges: JudgeSummary[]
  dateConfirmedAt: string | null
}

export function listDemoDays() {
  return apiFetch<DemoDay[]>("/api/demo-days")
}

export function createDemoDay(payload: { eventName: string; eventDate: string; venue?: string | null; theme?: string | null }) {
  return apiFetch<DemoDay>("/api/demo-days", { method: "POST", body: JSON.stringify(payload) })
}

export function joinAsJudge(demoDayId: number) {
  return apiFetch<DemoDay>(`/api/demo-days/${demoDayId}/judges`, { method: "POST" })
}

export function withdrawAsJudge(demoDayId: number) {
  return apiFetch<DemoDay>(`/api/demo-days/${demoDayId}/judges`, { method: "DELETE" })
}

export function getCurrentDemoDayForStartup(startupId: number) {
  return apiFetch<DemoDay | null>(`/api/startups/${startupId}/demo-days/current`)
}

export function joinDemoDay(startupId: number, demoDayId: number) {
  return apiFetch<DemoDay>(`/api/startups/${startupId}/demo-days/${demoDayId}/join`, { method: "POST" })
}

export function confirmDemoDayDate(startupId: number, demoDayId: number) {
  return apiFetch<DemoDay>(`/api/startups/${startupId}/demo-days/${demoDayId}/confirm-date`, { method: "POST" })
}

export interface Evaluation {
  evaluationId: number
  demoDayId: number
  eventName: string
  eventDate: string
  startupId: number
  startupName: string
  innovationScore: number | null
  technicalScore: number | null
  businessScore: number | null
  presentationScore: number | null
  overallRemarks: string | null
}

export interface EvaluationSubmit {
  innovationScore: number
  technicalScore: number
  businessScore: number
  presentationScore: number
  overallRemarks: string | null
}

export function listMyEvaluations() {
  return apiFetch<Evaluation[]>("/api/demo-days/evaluations/mine")
}

export function submitEvaluation(evaluationId: number, payload: EvaluationSubmit) {
  return apiFetch<Evaluation>(`/api/demo-days/evaluations/${evaluationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}
