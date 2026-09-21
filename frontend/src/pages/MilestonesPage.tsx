import { useEffect, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { CalendarDays, List, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MilestoneVerifyAction } from "@/components/MilestoneVerifyAction"
import { StatusBadge } from "@/components/StatusBadge"
import { useAuth } from "@/context/AuthContext"
import { createMilestone, listMilestones, reopenMilestone, updateMilestoneStatus, type Milestone } from "@/lib/milestones"
import { listMembers, listStartups, type Startup } from "@/lib/startups"

// "YYYY-MM-DD" parsed as a local date — new Date(string) parses as UTC and
// can land on the wrong day depending on the viewer's timezone.
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function MilestonesPage() {
  const { id } = useParams<{ id: string }>()
  const startupId = Number(id)
  const { profile } = useAuth()

  const [idea, setIdea] = useState<Startup | null>(null)
  const [milestones, setMilestones] = useState<Milestone[] | null>(null)
  const [isMentor, setIsMentor] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  const [name, setName] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const loadMilestones = () => {
    listMilestones(startupId)
      .then(setMilestones)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }

  useEffect(() => {
    listStartups()
      .then((all) => setIdea(all.find((s) => s.startupId === startupId) ?? null))
      .catch(() => setIdea(null))

    listMembers(startupId)
      .then((rows) => {
        const mine = rows.find((m) => m.userId === profile?.userId && m.status === "accepted")
        setIsMember(Boolean(mine))
        setIsMentor(mine?.projectRole === "mentor")
      })
      .catch(() => {
        setIsMember(false)
        setIsMentor(false)
      })

    loadMilestones()
  }, [startupId, profile?.userId])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)

    try {
      await createMilestone(startupId, { milestoneName: name, dueDate: dueDate || null })
      setName("")
      setDueDate("")
      setShowCreateForm(false)
      loadMilestones()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setCreating(false)
    }
  }

  const handleAdvance = async (milestoneId: number, status: "in_progress" | "completed") => {
    setBusyId(milestoneId)
    try {
      await updateMilestoneStatus(startupId, milestoneId, status)
      loadMilestones()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusyId(null)
    }
  }

  const handleReopen = async (milestoneId: number) => {
    setBusyId(milestoneId)
    try {
      await reopenMilestone(startupId, milestoneId)
      loadMilestones()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusyId(null)
    }
  }

  const milestoneDates = (milestones ?? []).filter((m) => m.dueDate).map((m) => parseLocalDate(m.dueDate!))
  const milestonesOnSelectedDate = selectedDate
    ? (milestones ?? []).filter((m) => m.dueDate && isSameDay(parseLocalDate(m.dueDate), selectedDate))
    : []

  const renderMilestoneCard = (m: Milestone) => (
    <Card key={m.milestoneId} className="rounded-2xl shadow-none">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">{m.milestoneName}</p>
            {m.dueDate && <p className="text-sm text-muted-foreground">Due {m.dueDate}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <StatusBadge status={m.status} />
            {m.status === "completed" && <StatusBadge status={m.verificationStatus} />}
            {isMember && m.status === "pending" && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full cursor-pointer"
                disabled={busyId === m.milestoneId}
                onClick={() => handleAdvance(m.milestoneId, "in_progress")}
              >
                Mark in progress
              </Button>
            )}
            {isMember && m.status === "in_progress" && (
              <Button
                size="sm"
                className="rounded-full cursor-pointer"
                disabled={busyId === m.milestoneId}
                onClick={() => handleAdvance(m.milestoneId, "completed")}
              >
                Mark complete
              </Button>
            )}
            {isMentor && m.status === "completed" && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full cursor-pointer"
                disabled={busyId === m.milestoneId}
                onClick={() => handleReopen(m.milestoneId)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reopen
              </Button>
            )}
          </div>
        </div>

        {m.mentorRemarks && (
          <p className="text-sm text-muted-foreground border-t border-border pt-3">
            <span className="font-medium text-foreground">Mentor remarks:</span> {m.mentorRemarks}
          </p>
        )}

        {isMentor && m.status === "completed" && m.verificationStatus === "unverified" && (
          <div className="border-t border-border pt-3">
            <MilestoneVerifyAction startupId={startupId} milestoneId={m.milestoneId} onDone={loadMilestones} />
          </div>
        )}
      </CardContent>
    </Card>
  )

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
          <p className="text-sm uppercase tracking-[0.2em] text-white/80 font-medium mb-4">Milestones</p>
          <h1 className="font-serif text-4xl lg:text-5xl text-white text-balance mb-4">
            {idea ? idea.startupName : "Loading..."}
          </h1>
          <p className="text-white/90 leading-relaxed">Track progress toward the next milestone.</p>
        </div>
      </div>

      <div className="px-10 mb-6">
        {idea && (
          <Link to={`/dashboard/ideas/${idea.startupId}`} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to idea
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-8 px-10">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl mb-1">Milestones</h2>
              <p className="text-muted-foreground text-sm">What this startup needs to hit next.</p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {milestones && milestones.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">No milestones yet.</p>
            </div>
          )}

          {milestones && milestones.length > 0 && (
            <Tabs defaultValue="list">
              <TabsList>
                <TabsTrigger value="list" className="cursor-pointer">
                  <List className="w-4 h-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="calendar" className="cursor-pointer">
                  <CalendarDays className="w-4 h-4" />
                  Calendar
                </TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="space-y-3">
                {milestones.map(renderMilestoneCard)}
              </TabsContent>

              <TabsContent value="calendar" className="space-y-4">
                <Card className="rounded-2xl shadow-none">
                  <CardContent className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      modifiers={{ hasMilestone: milestoneDates }}
                      modifiersClassNames={{
                        hasMilestone: "bg-amber-100 text-amber-900 font-medium",
                      }}
                    />
                  </CardContent>
                </Card>

                {selectedDate && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {milestonesOnSelectedDate.length > 0
                        ? `Due ${selectedDate.toLocaleDateString()}`
                        : `Nothing due ${selectedDate.toLocaleDateString()}`}
                    </p>
                    {milestonesOnSelectedDate.map(renderMilestoneCard)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

        {isMentor && (
          <div className="lg:sticky lg:top-10 self-start space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl mb-1">New milestone</h2>
                <p className="text-muted-foreground text-sm">Set the next thing this startup needs to hit.</p>
              </div>
            </div>

            {!showCreateForm ? (
              <Button
                variant="outline"
                className="w-full rounded-2xl h-auto py-4 justify-start gap-2 cursor-pointer"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="w-4 h-4" />
                Add a milestone
              </Button>
            ) : (
              <Card className="rounded-2xl shadow-none">
                <CardContent>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="milestoneName">Milestone name</Label>
                      <Input id="milestoneName" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due date (optional)</Label>
                      <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>

                    {createError && <p className="text-sm text-destructive">{createError}</p>}

                    <div className="flex items-center gap-3">
                      <Button type="submit" className="rounded-full" disabled={creating}>
                        {creating ? "Creating..." : "Create milestone"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
