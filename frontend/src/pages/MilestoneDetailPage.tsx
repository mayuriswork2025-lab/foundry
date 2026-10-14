import { useEffect, useState, type FormEvent } from "react"
import { Link, useParams } from "react-router-dom"
import { BellRing, CalendarPlus, Check, Pencil, Plus, RotateCcw, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ClaudeIcon } from "@/components/ClaudeIcon"
import { StatusBadge } from "@/components/StatusBadge"
import { useAuth } from "@/context/AuthContext"
import {
  addActionItem,
  addComment,
  createMeeting,
  listMeetings,
  updateActionItem,
  updateMeeting,
  type Meeting,
} from "@/lib/meetings"
import {
  listMilestones,
  reopenMilestone,
  requestMeetingForMilestone,
  updateMilestoneDetails,
  updateMilestoneStatus,
  verifyMilestone,
  type Milestone,
} from "@/lib/milestones"
import { listMembers, listStartups, type Membership, type Startup } from "@/lib/startups"
import { buildMilestonePrompt } from "@/lib/exportMilestonePrompt"

// ISO datetime -> the "YYYY-MM-DDTHH:mm" shape <input type="datetime-local"> needs.
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toCompactDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function buildGoogleCalendarUrl(meeting: Meeting, milestoneName: string, attendees: Membership[]): string {
  const start = new Date(meeting.scheduledAt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: meeting.agenda || `Meeting: ${milestoneName}`,
    dates: `${toCompactDateTime(start)}/${toCompactDateTime(end)}`,
    details: `Milestone: ${milestoneName}${meeting.discussion ? `\n\n${meeting.discussion}` : ""}`,
  })
  if (attendees.length > 0) {
    params.set("add", attendees.map((a) => a.email).join(","))
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function buildIcsDataUrl(meeting: Meeting, milestoneName: string, attendees: Membership[]): string {
  const start = new Date(meeting.scheduledAt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Foundry//Milestone Meeting//EN",
    "BEGIN:VEVENT",
    `UID:meeting-${meeting.meetingId}@foundry`,
    `DTSTAMP:${toCompactDateTime(new Date())}`,
    `DTSTART:${toCompactDateTime(start)}`,
    `DTEND:${toCompactDateTime(end)}`,
    `SUMMARY:${meeting.agenda || `Meeting: ${milestoneName}`}`,
    `DESCRIPTION:Milestone: ${milestoneName}`,
    ...attendees.map((a) => `ATTENDEE;CN=${a.firstName} ${a.lastName}:mailto:${a.email}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines)}`
}

export function MilestoneDetailPage() {
  const { id, milestoneId: milestoneIdParam } = useParams<{ id: string; milestoneId: string }>()
  const startupId = Number(id)
  const milestoneId = Number(milestoneIdParam)
  const { profile } = useAuth()

  const [idea, setIdea] = useState<Startup | null>(null)
  const [milestone, setMilestone] = useState<Milestone | null>(null)
  const [members, setMembers] = useState<Membership[] | null>(null)
  const [isMentee, setIsMentee] = useState(false)
  const [isMentor, setIsMentor] = useState(false)
  const [meetings, setMeetings] = useState<Meeting[] | null>(null)
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [verifyMode, setVerifyMode] = useState<"idle" | "verify" | "reject">("idle")
  const [verifyRemarks, setVerifyRemarks] = useState("")

  const [editingDetails, setEditingDetails] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)

  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [newScheduledAt, setNewScheduledAt] = useState("")
  const [newAgenda, setNewAgenda] = useState("")
  const [newActionItemText, setNewActionItemText] = useState<Record<number, string>>({})
  const [newCommentBody, setNewCommentBody] = useState<Record<number, string>>({})

  const [meetingAgenda, setMeetingAgenda] = useState("")
  const [meetingScheduledAt, setMeetingScheduledAt] = useState("")
  const [meetingDiscussion, setMeetingDiscussion] = useState("")
  const [savingMeeting, setSavingMeeting] = useState(false)

  const loadMilestone = () => {
    listMilestones(startupId)
      .then((rows) => setMilestone(rows.find((m) => m.milestoneId === milestoneId) ?? null))
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }

  const loadMeetings = () => {
    listMeetings(milestoneId)
      .then(setMeetings)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }

  useEffect(() => {
    listStartups()
      .then((all) => setIdea(all.find((s) => s.startupId === startupId) ?? null))
      .catch(() => setIdea(null))

    listMembers(startupId)
      .then((rows) => {
        setMembers(rows)
        const mine = rows.find((m) => m.userId === profile?.userId && m.status === "accepted")
        setIsMentee(Boolean(mine) && mine?.projectRole !== "mentor")
        setIsMentor(mine?.projectRole === "mentor")
      })
      .catch(() => {
        setMembers(null)
        setIsMentee(false)
        setIsMentor(false)
      })

    loadMilestone()
    loadMeetings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupId, milestoneId, profile?.userId])

  const startEditingDetails = () => {
    if (!milestone) return
    setEditName(milestone.milestoneName)
    setEditDescription(milestone.description ?? "")
    setEditError(null)
    setEditingDetails(true)
  }

  const handleSaveDetails = async (e: FormEvent) => {
    e.preventDefault()
    setEditError(null)
    setBusy(true)
    try {
      await updateMilestoneDetails(startupId, milestoneId, {
        milestoneName: editName,
        description: editDescription || null,
      })
      setEditingDetails(false)
      loadMilestone()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleExportToClaude = async () => {
    if (!milestone) return
    const prompt = buildMilestonePrompt(idea?.startupName ?? "my startup", milestone, meetings ?? [])
    try {
      // Clipboard copy is the reliable fallback — the ?q= pre-fill is a
      // best-effort attempt (unverified whether claude.ai's new-chat page
      // actually reads it), so nothing is lost if it doesn't work.
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, "_blank", "noopener,noreferrer")
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't copy to clipboard.")
    }
  }

  const handleAdvance = async (status: "in_progress" | "completed") => {
    setBusy(true)
    try {
      await updateMilestoneStatus(startupId, milestoneId, status)
      loadMilestone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleReopen = async () => {
    setBusy(true)
    try {
      await reopenMilestone(startupId, milestoneId)
      loadMilestone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyConfirm = async () => {
    setBusy(true)
    try {
      await verifyMilestone(startupId, milestoneId, {
        verificationStatus: verifyMode === "verify" ? "verified" : "rejected",
        remarks: verifyRemarks || null,
      })
      setVerifyMode("idle")
      setVerifyRemarks("")
      loadMilestone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleRequestMeeting = async () => {
    setBusy(true)
    try {
      await requestMeetingForMilestone(startupId, milestoneId)
      loadMilestone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleSchedule = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const meeting = await createMeeting(milestoneId, { scheduledAt: newScheduledAt, agenda: newAgenda || null })
      setNewScheduledAt("")
      setNewAgenda("")
      setShowScheduleForm(false)
      setSelectedMeetingId(meeting.meetingId)
      loadMeetings()
      loadMilestone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  const handleUpdateMeeting = async (meetingId: number, patch: Parameters<typeof updateMeeting>[2]) => {
    try {
      await updateMeeting(milestoneId, meetingId, patch)
      loadMeetings()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  const handleToggleActionItem = async (meetingId: number, actionItemId: number, isDone: boolean) => {
    try {
      await updateActionItem(milestoneId, meetingId, actionItemId, !isDone)
      loadMeetings()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  const handleAddActionItem = async (meetingId: number) => {
    const text = (newActionItemText[meetingId] ?? "").trim()
    if (!text) return
    try {
      await addActionItem(milestoneId, meetingId, text)
      setNewActionItemText((prev) => ({ ...prev, [meetingId]: "" }))
      loadMeetings()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  const handleAddComment = async (meetingId: number) => {
    const body = (newCommentBody[meetingId] ?? "").trim()
    if (!body) return
    try {
      await addComment(milestoneId, meetingId, body)
      setNewCommentBody((prev) => ({ ...prev, [meetingId]: "" }))
      loadMeetings()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  const selectedMeeting = meetings?.find((m) => m.meetingId === selectedMeetingId) ?? null

  useEffect(() => {
    if (selectedMeeting) {
      setMeetingAgenda(selectedMeeting.agenda ?? "")
      setMeetingScheduledAt(toDatetimeLocalValue(selectedMeeting.scheduledAt))
      setMeetingDiscussion(selectedMeeting.discussion ?? "")
    }
    // Only re-sync when a *different* meeting is selected — not on every
    // reload, so in-progress edits don't get stomped by a background refresh
    // (e.g. toggling an action item).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeeting?.meetingId])

  const handleSaveMeetingDetails = async () => {
    if (!selectedMeeting) return
    setSavingMeeting(true)
    try {
      await updateMeeting(milestoneId, selectedMeeting.meetingId, {
        agenda: meetingAgenda || null,
        scheduledAt: meetingScheduledAt,
        discussion: meetingDiscussion || null,
      })
      loadMeetings()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSavingMeeting(false)
    }
  }

  if (error) {
    return (
      <div className="px-10 py-10">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (!milestone) return null

  return (
    <div className="py-10">
      <div className="relative overflow-hidden mb-10 px-10 py-14 lg:py-16">
        <img src="/images/hero-bg.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative z-10 max-w-md">
          <p className="text-sm uppercase tracking-[0.2em] text-white/80 font-medium mb-4">Milestone</p>
          <h1 className="font-serif text-4xl lg:text-5xl text-white text-balance">Progress, discussion, and meetings.</h1>
        </div>
      </div>

      <div className="px-10 mb-6 flex items-center justify-between">
        <Link
          to={`/dashboard/ideas/${idea?.startupId ?? startupId}/milestones`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to milestones
        </Link>

        <Button variant="outline" className="rounded-full cursor-pointer" onClick={handleExportToClaude}>
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <ClaudeIcon className="w-4 h-4 text-[#D97757]" />
              Export to Claude
            </>
          )}
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 px-10">
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl font-serif">{milestone.milestoneName}</CardTitle>
                  <StatusBadge status={milestone.status} />
                  {milestone.status === "completed" && <StatusBadge status={milestone.verificationStatus} />}
                </div>
                {isMentor && !editingDetails && (
                  <button
                    type="button"
                    onClick={startEditingDetails}
                    aria-label="Edit milestone"
                    className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              {milestone.dueDate && <CardDescription>Due {milestone.dueDate}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-4">
              {editingDetails ? (
                <form onSubmit={handleSaveDetails} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="editName">Milestone name</Label>
                    <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editDescription">Description</Label>
                    <Textarea
                      id="editDescription"
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                    />
                  </div>

                  {editError && <p className="text-sm text-destructive">{editError}</p>}

                  <div className="flex items-center gap-3">
                    <Button type="submit" size="sm" className="rounded-full cursor-pointer" disabled={busy}>
                      {busy ? "Saving..." : "Save"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setEditingDetails(false)}
                      className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-foreground leading-relaxed">
                  {milestone.description || "No description yet."}
                </p>
              )}

              {milestone.mentorRemarks && (
                <p className="text-sm text-muted-foreground border-t border-border pt-4">
                  <span className="font-medium text-foreground">Mentor remarks:</span> {milestone.mentorRemarks}
                </p>
              )}

              {isMentee && milestone.meetingRequestedAt && (
                <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <BellRing className="w-4 h-4 shrink-0" />
                  Your mentor asked to schedule a meeting about this.
                </div>
              )}

              <div className="flex items-center gap-2 border-t border-border pt-4">
                {isMentee && milestone.status === "pending" && (
                  <Button
                    size="sm"
                    className="rounded-full cursor-pointer"
                    disabled={busy}
                    onClick={() => handleAdvance("in_progress")}
                  >
                    Mark in progress
                  </Button>
                )}
                {isMentee && milestone.status === "in_progress" && (
                  <Button
                    size="sm"
                    className="rounded-full cursor-pointer"
                    disabled={busy}
                    onClick={() => handleAdvance("completed")}
                  >
                    Mark complete
                  </Button>
                )}
                {isMentor && milestone.status === "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full cursor-pointer"
                    disabled={busy}
                    onClick={handleReopen}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reopen
                  </Button>
                )}
                {isMentor && !milestone.meetingRequestedAt && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full cursor-pointer"
                    disabled={busy}
                    onClick={handleRequestMeeting}
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    Ask for a meeting
                  </Button>
                )}
              </div>

              {isMentor && milestone.status === "completed" && milestone.verificationStatus === "unverified" && (
                <div className="border-t border-border pt-4">
                  {verifyMode === "idle" ? (
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-full cursor-pointer" onClick={() => setVerifyMode("verify")}>
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full cursor-pointer"
                        onClick={() => setVerifyMode("reject")}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Textarea
                        rows={2}
                        placeholder={verifyMode === "verify" ? "Add remarks (optional)" : "Why is this being rejected?"}
                        value={verifyRemarks}
                        onChange={(e) => setVerifyRemarks(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-full cursor-pointer" disabled={busy} onClick={handleVerifyConfirm}>
                          {verifyMode === "verify" ? "Confirm verification" : "Confirm rejection"}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setVerifyMode("idle")}
                          className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl mb-1">Meetings</h2>
              <p className="text-muted-foreground text-sm">Scheduled around this milestone.</p>
            </div>
            {isMentee && !showScheduleForm && (
              <Button variant="outline" className="rounded-full cursor-pointer" onClick={() => setShowScheduleForm(true)}>
                <Plus className="w-4 h-4" />
                Schedule a meeting
              </Button>
            )}
          </div>

          {showScheduleForm && (
            <Card className="rounded-2xl shadow-none">
              <CardContent>
                <form onSubmit={handleSchedule} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledAt">Date & time</Label>
                    <Input
                      id="scheduledAt"
                      type="datetime-local"
                      value={newScheduledAt}
                      onChange={(e) => setNewScheduledAt(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agenda">Agenda</Label>
                    <Input
                      id="agenda"
                      placeholder="What's this meeting about?"
                      value={newAgenda}
                      onChange={(e) => setNewAgenda(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" className="rounded-full cursor-pointer" disabled={busy}>
                      Schedule
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowScheduleForm(false)}
                      className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {meetings && meetings.length === 0 && !showScheduleForm && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">No meetings scheduled yet.</p>
            </div>
          )}

          <div className="space-y-3">
            {meetings
              ?.slice()
              .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
              .map((meeting) => {
                const selected = selectedMeetingId === meeting.meetingId
                return (
                  <button
                    key={meeting.meetingId}
                    type="button"
                    onClick={() => setSelectedMeetingId(meeting.meetingId)}
                    className="w-full text-left cursor-pointer"
                  >
                    <Card
                      className={cn(
                        "rounded-2xl shadow-none transition-colors",
                        selected ? "border-foreground" : "hover:border-foreground/30",
                      )}
                    >
                      <CardContent className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium">{meeting.agenda || "Untitled meeting"}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(meeting.scheduledAt).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                        <StatusBadge status={meeting.status} />
                      </CardContent>
                    </Card>
                  </button>
                )
              })}
          </div>
        </div>

        <div className="lg:sticky lg:top-10 self-start">
          {!selectedMeeting ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-muted-foreground">Select a meeting to see its details.</p>
            </div>
          ) : (
            <Card className="rounded-2xl shadow-none">
              <CardContent className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={meetingAgenda}
                      onChange={(e) => setMeetingAgenda(e.target.value)}
                      placeholder="Agenda"
                    />
                    <Input
                      type="datetime-local"
                      value={meetingScheduledAt}
                      onChange={(e) => setMeetingScheduledAt(e.target.value)}
                    />
                  </div>
                  <StatusBadge status={selectedMeeting.status} />
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  {selectedMeeting.status === "scheduled" && (
                    <>
                      <Button
                        size="sm"
                        className="rounded-full cursor-pointer"
                        onClick={() => handleUpdateMeeting(selectedMeeting.meetingId, { status: "completed" })}
                      >
                        Mark completed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full cursor-pointer"
                        onClick={() => handleUpdateMeeting(selectedMeeting.meetingId, { status: "cancelled" })}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full cursor-pointer"
                    disabled={savingMeeting}
                    onClick={handleSaveMeetingDetails}
                  >
                    {savingMeeting ? "Saving..." : "Save details"}
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-full cursor-pointer">
                    <a
                      href={buildGoogleCalendarUrl(selectedMeeting, milestone?.milestoneName ?? "Meeting", members ?? [])}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Add to Google Calendar
                    </a>
                  </Button>
                  <a
                    href={buildIcsDataUrl(selectedMeeting, milestone?.milestoneName ?? "Meeting", members ?? [])}
                    download={`${milestone?.milestoneName ?? "meeting"}.ics`}
                    className="text-sm text-muted-foreground underline underline-offset-4"
                  >
                    Download .ics
                  </a>
                </div>
                {members && members.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Invitees: {members.map((m) => `${m.firstName} ${m.lastName}`).join(", ")}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor={`discussion-${selectedMeeting.meetingId}`}>Discussion</Label>
                  <Textarea
                    id={`discussion-${selectedMeeting.meetingId}`}
                    rows={3}
                    placeholder="What was discussed?"
                    value={meetingDiscussion}
                    onChange={(e) => setMeetingDiscussion(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Action items</Label>
                  <div className="space-y-2">
                    {selectedMeeting.actionItems.map((item) => (
                      <label key={item.actionItemId} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={item.isDone}
                          onCheckedChange={() =>
                            handleToggleActionItem(selectedMeeting.meetingId, item.actionItemId, item.isDone)
                          }
                        />
                        <span className={item.isDone ? "line-through text-muted-foreground" : ""}>
                          {item.itemText}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add an action item..."
                      value={newActionItemText[selectedMeeting.meetingId] ?? ""}
                      onChange={(e) =>
                        setNewActionItemText((prev) => ({ ...prev, [selectedMeeting.meetingId]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddActionItem(selectedMeeting.meetingId)
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full cursor-pointer shrink-0"
                      onClick={() => handleAddActionItem(selectedMeeting.meetingId)}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Comments</Label>
                  <div className="space-y-3">
                    {selectedMeeting.comments.map((comment) => (
                      <div key={comment.commentId} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium">
                            {comment.authorFirstName} {comment.authorLastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1">{comment.body}</p>
                      </div>
                    ))}
                    {selectedMeeting.comments.length === 0 && (
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={newCommentBody[selectedMeeting.meetingId] ?? ""}
                      onChange={(e) =>
                        setNewCommentBody((prev) => ({ ...prev, [selectedMeeting.meetingId]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddComment(selectedMeeting.meetingId)
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full cursor-pointer shrink-0"
                      onClick={() => handleAddComment(selectedMeeting.meetingId)}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
