import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/context/AuthContext"
import { approveMentorRequest, listInbox, rejectMentorRequest, type MentorRequest } from "@/lib/mentoring"

export function MentorInboxPage() {
  const { profile } = useAuth()
  const [requests, setRequests] = useState<MentorRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = () => {
    listInbox()
      .then(setRequests)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }

  useEffect(load, [])

  const handleApprove = async (requestId: number) => {
    setBusyId(requestId)
    try {
      await approveMentorRequest(requestId)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (requestId: number) => {
    setBusyId(requestId)
    try {
      await rejectMentorRequest(requestId)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="px-10 py-10 max-w-4xl">
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
          <p className="text-white/90 leading-relaxed">Founders asking for a mentor, waiting on you.</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1">Mentor Requests</h2>
        <p className="text-muted-foreground text-sm">Pick up any request that's a fit — first to approve gets it.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {requests && requests.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No open requests right now.</p>
        </div>
      )}

      {requests && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((r) => (
            <Card key={r.mentorRequestId} className="rounded-2xl shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-medium">{r.startupName}</CardTitle>
                    <CardDescription>
                      Requested by {r.requesterFirstName} {r.requesterLastName}
                    </CardDescription>
                  </div>
                  <Link
                    to={`/dashboard/ideas/${r.startupId}`}
                    className="text-sm text-foreground underline underline-offset-4 shrink-0"
                  >
                    View idea
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {r.requiredSkills && (
                  <p className="text-sm">
                    <span className="font-medium">Looking for:</span> {r.requiredSkills}
                  </p>
                )}
                {r.requestDescription && <p className="text-sm text-muted-foreground">{r.requestDescription}</p>}

                <div className="flex gap-2 pt-2">
                  <Button
                    className="rounded-full cursor-pointer"
                    onClick={() => handleApprove(r.mentorRequestId)}
                    disabled={busyId === r.mentorRequestId}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full cursor-pointer"
                    onClick={() => handleReject(r.mentorRequestId)}
                    disabled={busyId === r.mentorRequestId}
                  >
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
