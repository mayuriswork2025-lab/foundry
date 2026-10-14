import { useEffect, useState } from "react"
import { CalendarDays, Gavel, MapPin } from "lucide-react"
import { JudgeEvaluations } from "@/components/JudgeEvaluations"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"
import { joinAsJudge, listDemoDays, withdrawAsJudge, type DemoDay } from "@/lib/demoDay"

export function MentorDemoDaysPage() {
  const { profile } = useAuth()
  const [demoDays, setDemoDays] = useState<DemoDay[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyDemoDayId, setBusyDemoDayId] = useState<number | null>(null)

  useEffect(() => {
    listDemoDays()
      .then(setDemoDays)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }, [])

  const handleToggleJudge = async (demoDay: DemoDay) => {
    setBusyDemoDayId(demoDay.demoDayId)
    setError(null)
    try {
      const updated = demoDay.amJudging ? await withdrawAsJudge(demoDay.demoDayId) : await joinAsJudge(demoDay.demoDayId)
      setDemoDays((prev) => prev?.map((d) => (d.demoDayId === updated.demoDayId ? updated : d)) ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusyDemoDayId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })

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
            Sign up to judge an upcoming demo day and evaluate the startups presenting.
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-serif text-2xl mb-1">Judge demo days</h2>
        <p className="text-muted-foreground text-sm">
          Founders can only join a demo day once at least one judge has signed up.
        </p>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {demoDays && demoDays.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No upcoming demo days yet.</p>
        </div>
      )}

      {demoDays && demoDays.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {demoDays.map((demoDay) => (
            <div
              key={demoDay.demoDayId}
              className="p-6 rounded-3xl border border-border hover:bg-zinc-50 transition-colors duration-300"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center">
                  <Gavel className="w-4.5 h-4.5 text-foreground" strokeWidth={1.5} />
                </div>
                {demoDay.theme && (
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {demoDay.theme}
                  </span>
                )}
              </div>

              <h3 className="text-lg font-medium text-foreground mb-1">{demoDay.eventName}</h3>
              <p className="text-sm text-muted-foreground mb-4">{formatDate(demoDay.eventDate)}</p>

              <div className="space-y-1.5 text-sm text-muted-foreground mb-5">
                {demoDay.venue && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {demoDay.venue}
                  </p>
                )}
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                  {demoDay.judges.length} judge{demoDay.judges.length === 1 ? "" : "s"} signed up
                </p>
              </div>

              <Button
                variant={demoDay.amJudging ? "outline" : "default"}
                className="rounded-full cursor-pointer"
                onClick={() => handleToggleJudge(demoDay)}
                disabled={busyDemoDayId === demoDay.demoDayId}
              >
                {busyDemoDayId === demoDay.demoDayId
                  ? "Saving..."
                  : demoDay.amJudging
                    ? "Withdraw"
                    : "Sign up to judge"}
              </Button>
            </div>
          ))}
        </div>
      )}

      <JudgeEvaluations />
    </div>
  )
}
