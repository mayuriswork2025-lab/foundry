import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MilestoneVerifyAction } from "@/components/MilestoneVerifyAction"
import { StatusBadge } from "@/components/StatusBadge"
import { useAuth } from "@/context/AuthContext"
import {
  listMilestoneNotifications,
  reopenMilestone,
  updateMilestoneStatus,
  type MilestoneNotification,
} from "@/lib/milestones"

export function MilestoneInboxPage() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<MilestoneNotification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = () => {
    listMilestoneNotifications()
      .then(setNotifications)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }

  useEffect(load, [])

  const handleAdvance = async (n: MilestoneNotification, status: "in_progress" | "completed") => {
    setBusyId(n.milestoneId)
    try {
      await updateMilestoneStatus(n.startupId, n.milestoneId, status)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusyId(null)
    }
  }

  const handleReopen = async (n: MilestoneNotification) => {
    setBusyId(n.milestoneId)
    try {
      await reopenMilestone(n.startupId, n.milestoneId)
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
          <p className="text-white/90 leading-relaxed">Milestones across your ideas that need attention.</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1">Milestones</h2>
        <p className="text-muted-foreground text-sm">New milestones and ones with a due date coming up.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {notifications && notifications.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">You're all caught up.</p>
        </div>
      )}

      {notifications && notifications.length > 0 && (
        <div className="space-y-4">
          {notifications.map((n) => (
            <Card key={n.milestoneId} className="rounded-2xl shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-medium">{n.milestoneName}</CardTitle>
                    <CardDescription>{n.startupName}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={n.status} />
                    <Link
                      to={`/dashboard/ideas/${n.startupId}/milestones`}
                      className="text-sm text-foreground underline underline-offset-4"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{n.dueDate ? `Due ${n.dueDate}` : "No due date"}</p>
                  <div className="flex gap-2">
                    {n.status === "pending" && (
                      <Button
                        size="sm"
                        className="rounded-full cursor-pointer"
                        disabled={busyId === n.milestoneId}
                        onClick={() => handleAdvance(n, "in_progress")}
                      >
                        Mark in progress
                      </Button>
                    )}
                    {n.status === "in_progress" && (
                      <Button
                        size="sm"
                        className="rounded-full cursor-pointer"
                        disabled={busyId === n.milestoneId}
                        onClick={() => handleAdvance(n, "completed")}
                      >
                        Mark complete
                      </Button>
                    )}
                  </div>
                </div>

                {profile?.roleName === "mentor" && n.status === "completed" && n.verificationStatus === "unverified" && (
                  <div className="border-t border-border pt-3 flex items-start justify-between gap-4">
                    <MilestoneVerifyAction startupId={n.startupId} milestoneId={n.milestoneId} onDone={load} />
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full cursor-pointer shrink-0"
                      disabled={busyId === n.milestoneId}
                      onClick={() => handleReopen(n)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reopen
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
