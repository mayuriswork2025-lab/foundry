import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowRight, CalendarCheck, CalendarDays, CalendarPlus, CheckCircle2, MapPin, Rocket, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { listStartups, type Startup } from "@/lib/startups"
import { confirmDemoDayDate, getCurrentDemoDayForStartup, joinDemoDay, listDemoDays, type DemoDay } from "@/lib/demoDay"

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

function toCompactDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/** All-day event — demo days only carry a date, not a specific time. */
function buildGoogleCalendarUrl(demoDay: DemoDay, startupName: string): string {
  const start = new Date(`${demoDay.eventDate}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${startupName} at ${demoDay.eventName}`,
    dates: `${toCompactDate(start)}/${toCompactDate(end)}`,
    details: `Demo day presentation for ${startupName}.`,
    ...(demoDay.venue ? { location: demoDay.venue } : {}),
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Generic .ics download — works with Apple Calendar, Outlook, etc. */
function buildIcsDataUrl(demoDay: DemoDay, startupName: string): string {
  const start = new Date(`${demoDay.eventDate}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Foundry//Demo Day//EN",
    "BEGIN:VEVENT",
    `UID:demo-day-${demoDay.demoDayId}@foundry`,
    `DTSTAMP:${toCompactDate(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${toCompactDate(start)}`,
    `DTEND;VALUE=DATE:${toCompactDate(end)}`,
    `SUMMARY:${startupName} at ${demoDay.eventName}`,
    demoDay.venue ? `LOCATION:${demoDay.venue}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n")

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines)}`
}

export function DemoDayPage() {
  const { id } = useParams<{ id: string }>()
  const startupId = Number(id)

  const [idea, setIdea] = useState<Startup | null>(null)
  const [demoDays, setDemoDays] = useState<DemoDay[] | null>(null)
  const [currentDemoDay, setCurrentDemoDay] = useState<DemoDay | null | undefined>(undefined)
  const [confirmingDate, setConfirmingDate] = useState(false)
  const [busyDemoDayId, setBusyDemoDayId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listStartups()
      .then((all) => setIdea(all.find((s) => s.startupId === startupId) ?? null))
      .catch(() => setIdea(null))
  }, [startupId])

  useEffect(() => {
    listDemoDays()
      .then(setDemoDays)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
    getCurrentDemoDayForStartup(startupId)
      .then(setCurrentDemoDay)
      .catch(() => setCurrentDemoDay(null))
  }, [startupId])

  const handleJoin = async (demoDayId: number) => {
    setBusyDemoDayId(demoDayId)
    setError(null)
    try {
      const joined = await joinDemoDay(startupId, demoDayId)
      setCurrentDemoDay(joined)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusyDemoDayId(null)
    }
  }

  const handleBackToPicker = () => {
    setCurrentDemoDay(null)
  }

  const handleConfirmDate = async () => {
    if (!currentDemoDay) return
    setConfirmingDate(true)
    setError(null)
    try {
      const updated = await confirmDemoDayDate(startupId, currentDemoDay.demoDayId)
      setCurrentDemoDay(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setConfirmingDate(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const loading = demoDays === null || currentDemoDay === undefined

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
          <p className="text-sm uppercase tracking-[0.2em] text-white/80 font-medium mb-4">Demo Day</p>
          <h1 className="font-serif text-4xl lg:text-5xl text-white text-balance mb-4">
            {currentDemoDay ? "You're in!" : "Proceed to demo day"}
          </h1>
          <p className="text-white/90 leading-relaxed">
            {currentDemoDay
              ? "Here's how your startup gets matched with judges and a date."
              : "Pick an upcoming demo day for your startup to present at."}
          </p>
        </div>
      </div>

      <div className="px-10 mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/dashboard/ideas/${startupId}`}>{idea?.startupName ?? "Idea"}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {currentDemoDay ? (
              <>
                {!currentDemoDay.dateConfirmedAt && (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <button onClick={handleBackToPicker} className="cursor-pointer">
                          Proceed to demo day
                        </button>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
                <BreadcrumbItem>
                  <BreadcrumbPage>You're in</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>Proceed to demo day</BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="px-10">
        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!loading && !currentDemoDay && (
          <DemoDayPicker
            demoDays={demoDays ?? []}
            busyDemoDayId={busyDemoDayId}
            onJoin={handleJoin}
            formatDate={formatDate}
          />
        )}

        {!loading && currentDemoDay && (
          <DemoDayMatch
            demoDay={currentDemoDay}
            idea={idea}
            formatDate={formatDate}
            confirmingDate={confirmingDate}
            onConfirmDate={handleConfirmDate}
          />
        )}
      </div>
    </div>
  )
}

function DemoDayPicker({
  demoDays,
  busyDemoDayId,
  onJoin,
  formatDate,
}: {
  demoDays: DemoDay[]
  busyDemoDayId: number | null
  onJoin: (demoDayId: number) => void
  formatDate: (iso: string) => string
}) {
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
  }
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  }

  if (demoDays.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming demo days yet — check back soon.</p>
  }

  const soonestId = demoDays.reduce((soonest, d) => (d.eventDate < soonest.eventDate ? d : soonest)).demoDayId

  return (
    <motion.div initial="hidden" animate="show" variants={container} className="grid gap-4 sm:grid-cols-2">
      {demoDays.map((demoDay) => {
        const isSoonest = demoDay.demoDayId === soonestId
        const daysAway = daysUntil(demoDay.eventDate)
        const hasJudges = demoDay.judges.length > 0

        return (
          <motion.div
            key={demoDay.demoDayId}
            variants={item}
            className="p-6 rounded-3xl border border-border hover:bg-zinc-50 transition-colors duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center">
                <Rocket className="w-4.5 h-4.5 text-foreground" strokeWidth={1.5} />
              </div>
              <div className="flex items-center gap-2">
                {demoDay.theme && (
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {demoDay.theme}
                  </span>
                )}
                {isSoonest && (
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">· Next up</span>
                )}
              </div>
            </div>

            <h3 className="text-lg font-medium text-foreground mb-1">{demoDay.eventName}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {formatDate(demoDay.eventDate)} · {daysAway === 0 ? "Today" : `${daysAway} days away`}
            </p>

            <div className="space-y-1.5 text-sm text-muted-foreground mb-5">
              {demoDay.venue && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {demoDay.venue}
                </p>
              )}
              <p className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 shrink-0" />
                {hasJudges
                  ? `Judged by ${demoDay.judges.map((j) => `${j.firstName} ${j.lastName}`).join(", ")}`
                  : "No judges signed up yet"}
              </p>
            </div>

            <Button
              className="rounded-full cursor-pointer"
              onClick={() => onJoin(demoDay.demoDayId)}
              disabled={!hasJudges || busyDemoDayId === demoDay.demoDayId}
              title={hasJudges ? undefined : "Waiting on a mentor to sign up as a judge first"}
            >
              {busyDemoDayId === demoDay.demoDayId
                ? "Joining..."
                : hasJudges
                  ? "Join this demo day"
                  : "Waiting on judges"}
            </Button>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

function DemoDayMatch({
  demoDay,
  idea,
  formatDate,
  confirmingDate,
  onConfirmDate,
}: {
  demoDay: DemoDay
  idea: Startup | null
  formatDate: (iso: string) => string
  confirmingDate: boolean
  onConfirmDate: () => void
}) {
  const dateConfirmed = demoDay.dateConfirmedAt !== null
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
  }
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  }

  const daysAway = daysUntil(demoDay.eventDate)
  const assignedJudges = demoDay.assignedJudges

  return (
    <motion.div initial="hidden" animate="show" variants={container} className="max-w-4xl space-y-10">
      <motion.div variants={item} className="flex items-center gap-3 sm:gap-6 max-w-xl">
        <FlowNode icon={Rocket} label="Startup" active />
        <FlowConnector />
        <FlowNode
          icon={Users}
          label={`${assignedJudges.length} Judge${assignedJudges.length === 1 ? "" : "s"}`}
          active={assignedJudges.length > 0}
        />
        <FlowConnector />
        <FlowNode icon={CalendarDays} label={dateConfirmed ? "Date set" : "Date"} active={dateConfirmed} />
      </motion.div>

      <motion.div variants={item}>
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground font-medium mb-2">Confirmed</p>
        <h2 className="font-serif text-3xl text-foreground text-balance mb-2">
          {idea?.startupName ?? "Your startup"} is presenting at {demoDay.eventName}
        </h2>
        <p className="text-muted-foreground">
          Matched with {assignedJudges.length} judge{assignedJudges.length === 1 ? "" : "s"} ·{" "}
          {daysAway === 0 ? "today" : `${daysAway} day${daysAway === 1 ? "" : "s"} away`}
        </p>
      </motion.div>

      <div>
        <motion.p variants={item} className="text-sm uppercase tracking-[0.15em] text-muted-foreground font-medium mb-3">
          Your judges
        </motion.p>
        <div className="grid gap-4 md:grid-cols-3">
          {assignedJudges.map((judge, i) => (
            <motion.div
              key={judge.mentorId}
              variants={item}
              className="relative p-6 rounded-3xl border border-border hover:bg-zinc-50 transition-colors duration-300 h-full flex flex-col overflow-hidden"
            >
              <span className="absolute -right-1 -top-3 font-serif text-6xl text-foreground/5 select-none">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="relative w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center text-xs font-semibold text-foreground mb-4">
                {initials(judge.firstName, judge.lastName)}
              </div>
              <h3 className="relative text-base font-medium text-foreground">
                {judge.firstName} {judge.lastName}
              </h3>
              <p className="relative text-sm text-muted-foreground mt-1">
                Will be evaluating your startup at this demo day.
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div variants={item} className="p-6 rounded-3xl border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="shrink-0 text-center">
            <p className="font-light text-5xl leading-none text-foreground">{daysAway}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
              day{daysAway === 1 ? "" : "s"} away
            </p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div>
            <p className="text-lg font-medium text-foreground">{formatDate(demoDay.eventDate)}</p>
            {demoDay.venue && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {demoDay.venue}
              </p>
            )}
          </div>
        </div>

        {dateConfirmed ? (
          <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
            <p className="text-sm text-foreground flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Date confirmed
            </p>
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" size="sm" className="rounded-full cursor-pointer">
                <a
                  href={buildGoogleCalendarUrl(demoDay, idea?.startupName ?? "Your startup")}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  Add to Google Calendar
                </a>
              </Button>
              <a
                href={buildIcsDataUrl(demoDay, idea?.startupName ?? "Your startup")}
                download={`${demoDay.eventName}.ics`}
                className="text-sm text-muted-foreground underline underline-offset-4"
              >
                Download .ics
              </a>
            </div>
          </div>
        ) : (
          <Button className="rounded-full cursor-pointer shrink-0" onClick={onConfirmDate} disabled={confirmingDate}>
            <CalendarCheck className="w-4 h-4" />
            {confirmingDate ? "Confirming..." : "Confirm this date"}
          </Button>
        )}
      </motion.div>
    </motion.div>
  )
}

function FlowNode({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof Rocket
  label: string
  active: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
          active ? "bg-foreground text-background" : "bg-foreground/5 text-foreground"
        }`}
      >
        <Icon className="w-4.5 h-4.5" strokeWidth={1.5} />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide whitespace-nowrap">{label}</p>
    </div>
  )
}

function FlowConnector() {
  return (
    <div className="flex-1 flex items-center text-border -mt-5">
      <div className="flex-1 h-px bg-border" />
      <ArrowRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
    </div>
  )
}
