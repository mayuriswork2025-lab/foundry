import { useAuth } from "@/context/AuthContext"
import { IdeasListPage } from "@/pages/IdeasListPage"
import { MentorDemoDaysPage } from "@/pages/MentorDemoDaysPage"
import { MentorIdeasPage } from "@/pages/MentorIdeasPage"

export function DashboardHome() {
  const { profile } = useAuth()
  if (profile?.roleName === "judge") return <MentorDemoDaysPage />
  return profile?.roleName === "mentor" ? <MentorIdeasPage /> : <IdeasListPage />
}
