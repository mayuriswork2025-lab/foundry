import { Route, Routes } from "react-router-dom"
import { AuthPage } from "@/pages/AuthPage"
import { LandingPage } from "@/pages/LandingPage"
import { MentorWelcomePage } from "@/pages/MentorWelcomePage"
import { NewStartupPage } from "@/pages/NewStartupPage"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/startups/new" element={<NewStartupPage />} />
      <Route path="/mentor" element={<MentorWelcomePage />} />
    </Routes>
  )
}
