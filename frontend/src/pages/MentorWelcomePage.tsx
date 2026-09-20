import { useAuth } from "@/context/AuthContext"

export function MentorWelcomePage() {
  const { profile, loading } = useAuth()

  if (loading) return null

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24 bg-background text-center">
      <div>
        <h1 className="font-serif text-4xl mb-4">
          {profile ? `Welcome, ${profile.firstName}` : "Welcome"}
        </h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          You're signed up as a mentor. Startup requests and mentorship tools are coming soon.
        </p>
      </div>
    </main>
  )
}
