import { Route, Routes } from "react-router-dom"
import { LandingPage } from "@/pages/LandingPage"
import { LoginPage } from "@/pages/LoginPage"
import { MentorWelcomePage } from "@/pages/MentorWelcomePage"
import { NewStartupPage } from "@/pages/NewStartupPage"
import { SignupPage } from "@/pages/SignupPage"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/startups/new" element={<NewStartupPage />} />
      <Route path="/mentor" element={<MentorWelcomePage />} />
    </Routes>
  )
}
