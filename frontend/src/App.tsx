import { Route, Routes } from "react-router-dom"
import { AuthPage } from "@/pages/AuthPage"
import { DashboardLayout } from "@/components/DashboardLayout"
import { DashboardHome } from "@/pages/DashboardHome"
import { GuidingStartupsPage } from "@/pages/GuidingStartupsPage"
import { IdeaDetailPage } from "@/pages/IdeaDetailPage"
import { IdeaFormPage } from "@/pages/IdeaFormPage"
import { LandingPage } from "@/pages/LandingPage"
import { MentorInboxPage } from "@/pages/MentorInboxPage"
import { MilestoneInboxPage } from "@/pages/MilestoneInboxPage"
import { MilestonesPage } from "@/pages/MilestonesPage"
import { RequestMentorPage } from "@/pages/RequestMentorPage"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="guiding" element={<GuidingStartupsPage />} />
        <Route path="inbox" element={<MentorInboxPage />} />
        <Route path="milestones" element={<MilestoneInboxPage />} />
        <Route path="ideas/new" element={<IdeaFormPage />} />
        <Route path="ideas/:id" element={<IdeaDetailPage />} />
        <Route path="ideas/:id/edit" element={<IdeaFormPage />} />
        <Route path="ideas/:id/milestones" element={<MilestonesPage />} />
        <Route path="ideas/:id/request-mentor" element={<RequestMentorPage />} />
      </Route>
    </Routes>
  )
}
