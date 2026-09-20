import { Layout } from "@/components/Layout"
import { useAuth } from "@/context/AuthContext"

export function MentorWelcomePage() {
  const { profile, loading } = useAuth()

  return (
    <Layout>
      <main className="relative min-h-screen flex items-center justify-center px-6 py-32 overflow-hidden text-center">
        {/* Same wildflower-valley imagery as the landing page footer, for continuity */}
        <img
          src="/images/hero-bg.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />

        {!loading && (
          <div className="relative z-10">
            <h1 className="font-serif text-4xl mb-4">
              {profile ? `Welcome, ${profile.firstName}` : "Welcome"}
            </h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              You're signed up as a mentor. Startup requests and mentorship tools are coming soon.
            </p>
          </div>
        )}
      </main>
    </Layout>
  )
}
