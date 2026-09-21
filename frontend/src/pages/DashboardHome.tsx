import { useAuth } from "@/context/AuthContext"
import { IdeasListPage } from "@/pages/IdeasListPage"
import { MentorIdeasPage } from "@/pages/MentorIdeasPage"

export function DashboardHome() {
  const { profile } = useAuth()
  return profile?.roleName === "mentor" ? <MentorIdeasPage /> : <IdeasListPage />
}
