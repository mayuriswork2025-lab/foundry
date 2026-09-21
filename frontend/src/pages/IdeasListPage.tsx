import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { CheckCircle2, Clock, Crown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InviteSearch } from "@/components/InviteSearch"
import { StatusBadge } from "@/components/StatusBadge"
import { useAuth } from "@/context/AuthContext"
import {
  inviteMember,
  listMembers,
  listStartups,
  type Membership,
  type Startup,
  type UserSummary,
} from "@/lib/startups"

export function IdeasListPage() {
  const { profile } = useAuth()
  const [ideas, setIdeas] = useState<Startup[] | null>(null)
  const [members, setMembers] = useState<Record<number, Membership[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<Record<number, string>>({})

  const loadMembers = (startupId: number) => {
    listMembers(startupId)
      .then((rows) => setMembers((prev) => ({ ...prev, [startupId]: rows })))
      .catch(() => {
        /* not an accepted member yet — no team to show */
      })
  }

  useEffect(() => {
    listStartups()
      .then((rows) => {
        setIdeas(rows)
        rows.filter((idea) => idea.memberStatus !== "invited").forEach((idea) => loadMembers(idea.startupId))
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }, [])

  const handleInvite = (startupId: number, founder: UserSummary) => {
    setInviteError((prev) => ({ ...prev, [startupId]: "" }))
    inviteMember(startupId, founder.email)
      .then(() => loadMembers(startupId))
      .catch((err) =>
        setInviteError((prev) => ({
          ...prev,
          [startupId]: err instanceof Error ? err.message : "Something went wrong.",
        })),
      )
  }

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
          <p className="text-white/90 leading-relaxed">
            Draft an idea, bring people onto it, and submit it to mentors when you're ready.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-serif text-2xl mb-1">Your ideas</h2>
          <p className="text-muted-foreground text-sm">Drafts stay private until you submit them.</p>
        </div>
        <Button asChild className="rounded-full">
          <Link to="/dashboard/ideas/new">Draft an idea</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {ideas && ideas.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground mb-4">You haven't drafted an idea yet.</p>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/dashboard/ideas/new">Draft your first idea</Link>
          </Button>
        </div>
      )}

      {ideas && ideas.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-6">
          {ideas.map((idea) => {
            const isFounder = idea.registeredBy === profile?.userId
            const isAccepted = idea.memberStatus !== "invited"
            const team = members[idea.startupId] ?? []

            return (
              <Card key={idea.startupId} className="rounded-2xl shadow-none">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-medium">{idea.startupName}</CardTitle>
                    <StatusBadge status={idea.memberStatus === "invited" ? "invited" : idea.registrationStatus} />
                  </div>
                  {idea.domain && <p className="text-sm text-muted-foreground">{idea.domain}</p>}
                </CardHeader>
                <CardContent className="space-y-4">
                  {idea.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{idea.description}</p>
                  )}

                  {isAccepted && team.length > 0 && (
                    <div className="space-y-1.5">
                      {team.map((m) => (
                        <div key={m.membershipId} className="flex items-center gap-2 text-sm">
                          {m.status === "accepted" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className="truncate">
                            {m.firstName} {m.lastName}
                          </span>
                          {m.projectRole === "mentor" && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Mentor" />
                          )}
                          <span className="text-xs text-muted-foreground shrink-0">
                            {m.status === "accepted" ? "" : "invite sent"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <Link
                      to={`/dashboard/ideas/${idea.startupId}`}
                      className="text-sm text-foreground underline underline-offset-4"
                    >
                      View
                    </Link>
                    {isFounder && isAccepted && (
                      <InviteSearch onInvite={(founder) => handleInvite(idea.startupId, founder)} />
                    )}
                  </div>
                  {inviteError[idea.startupId] && (
                    <p className="text-sm text-destructive">{inviteError[idea.startupId]}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
