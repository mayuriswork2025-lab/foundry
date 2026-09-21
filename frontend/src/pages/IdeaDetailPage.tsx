import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Crown, ListChecks, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { InviteSearch } from "@/components/InviteSearch"
import { StatusBadge } from "@/components/StatusBadge"
import { useAuth } from "@/context/AuthContext"
import {
  acceptInvite,
  approveStartup,
  inviteMember,
  listMembers,
  listStartups,
  submitStartup,
  type Membership,
  type Startup,
  type UserSummary,
} from "@/lib/startups"

export function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const startupId = Number(id)
  const { profile } = useAuth()

  const [idea, setIdea] = useState<Startup | null>(null)
  const [members, setMembers] = useState<Membership[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  const isFounder = idea != null && profile != null && idea.registeredBy === profile.userId
  const isMentor = profile?.roleName === "mentor"
  const isAccepted = idea?.memberStatus !== "invited"

  const load = () => {
    listStartups()
      .then((all) => {
        const found = all.find((s) => s.startupId === startupId) ?? null
        setIdea(found)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }

  useEffect(load, [startupId])

  useEffect(() => {
    if (idea && idea.memberStatus !== "invited") {
      listMembers(startupId)
        .then(setMembers)
        .catch(() => setMembers(null))
    }
  }, [idea, startupId])

  const handleAccept = async () => {
    setBusy(true)
    try {
      await acceptInvite(startupId)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    setBusy(true)
    try {
      await submitStartup(startupId)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async () => {
    setBusy(true)
    try {
      await approveStartup(startupId)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleInvite = async (founder: UserSummary) => {
    setInviteError(null)
    setBusy(true)
    try {
      await inviteMember(startupId, founder.email)
      const rows = await listMembers(startupId)
      setMembers(rows)
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="px-10 py-10">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!idea) return null

  return (
    <div className="py-10">
      <div className="relative overflow-hidden mb-10 px-10 py-14 lg:py-16">
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
          <p className="text-white/90 leading-relaxed">Here's where this idea stands.</p>
        </div>
      </div>

      <div className="px-10 mb-6">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-block">
          ← Back to your ideas
        </Link>
      </div>

      {idea.memberStatus === "invited" && (
        <div className="px-10 mb-6">
          <Card className="rounded-2xl shadow-none border-blue-200 bg-blue-50">
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-blue-900">You've been invited to collaborate on this idea.</p>
              <Button className="rounded-full cursor-pointer" onClick={handleAccept} disabled={busy}>
                Accept invite
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8 px-10">
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl font-serif">{idea.startupName}</CardTitle>
                  <StatusBadge status={idea.memberStatus === "invited" ? "invited" : idea.registrationStatus} />
                </div>
                {isFounder && (
                  <Link
                    to={`/dashboard/ideas/${idea.startupId}/edit`}
                    aria-label="Edit idea"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </Link>
                )}
              </div>
              {idea.domain && <CardDescription>{idea.domain}</CardDescription>}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed">{idea.description || "No description yet."}</p>
            </CardContent>
            {isFounder && idea.registrationStatus === "draft" && isAccepted && (
              <CardFooter className="border-t border-border pt-6">
                <Button className="rounded-full cursor-pointer" onClick={handleSubmit} disabled={busy}>
                  {busy ? "Submitting..." : "Submit idea"}
                </Button>
              </CardFooter>
            )}
            {isMentor && idea.registrationStatus === "pending" && (
              <CardFooter className="border-t border-border pt-6">
                <Button className="rounded-full cursor-pointer" onClick={handleApprove} disabled={busy}>
                  {busy ? "Approving..." : "Approve idea"}
                </Button>
              </CardFooter>
            )}
            {isFounder && idea.registrationStatus === "pending" && (
              <CardFooter className="border-t border-border pt-6">
                <Button asChild variant="outline" className="rounded-full cursor-pointer">
                  <Link to={`/dashboard/ideas/${idea.startupId}/request-mentor`}>Request mentorship</Link>
                </Button>
              </CardFooter>
            )}
            {idea.registrationStatus === "approved" && (
              <CardFooter className="border-t border-border pt-6">
                <Button asChild variant="outline" className="rounded-full cursor-pointer">
                  <Link to={`/dashboard/ideas/${idea.startupId}/milestones`}>
                    <ListChecks className="w-4 h-4" />
                    Track milestones
                  </Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {isAccepted && members && (
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Team</CardTitle>
              <CardDescription>Everyone with access to this idea.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {members?.map((m) => (
                <div key={m.membershipId} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium flex items-center gap-1.5">
                      {m.firstName} {m.lastName}
                      {m.projectRole === "mentor" && (
                        <Crown className="w-3.5 h-3.5 text-amber-500" aria-label="Mentor" />
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {m.email} · <span className="capitalize">{m.projectRole}</span>
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}

              {isFounder && (
                <div className="pt-4 border-t border-border">
                  <InviteSearch onInvite={handleInvite} disabled={busy} />
                </div>
              )}
              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
