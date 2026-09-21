import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/StatusBadge"
import { useAuth } from "@/context/AuthContext"
import { listGuidingStartups, type Startup } from "@/lib/startups"

export function GuidingStartupsPage() {
  const { profile } = useAuth()
  const [startups, setStartups] = useState<Startup[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listGuidingStartups()
      .then(setStartups)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }, [])

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="relative rounded-3xl overflow-hidden mb-10 px-8 py-14 lg:py-16">
        <img
          src="/images/hero-bg.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative z-10 max-w-md">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80 font-medium mb-4">Dashboard</p>
          <h1 className="font-serif text-4xl lg:text-5xl text-white text-balance mb-4">
            Welcome back, {profile?.firstName}
          </h1>
          <p className="text-white/90 leading-relaxed">The startups you're guiding, all in one place.</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1">Guiding Startups</h2>
        <p className="text-muted-foreground text-sm">Ideas you've approved and are now mentoring.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {startups && startups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">
            You haven't approved any ideas yet — browse submitted ideas to get started.
          </p>
        </div>
      )}

      {startups && startups.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-6">
          {startups.map((startup) => (
            <Card key={startup.startupId} className="rounded-2xl shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg font-medium">{startup.startupName}</CardTitle>
                  <StatusBadge status={startup.registrationStatus} />
                </div>
                {startup.domain && <p className="text-sm text-muted-foreground">{startup.domain}</p>}
              </CardHeader>
              <CardContent className="space-y-4">
                {startup.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{startup.description}</p>
                )}
                <Link
                  to={`/dashboard/ideas/${startup.startupId}`}
                  className="text-sm text-foreground underline underline-offset-4"
                >
                  View
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
