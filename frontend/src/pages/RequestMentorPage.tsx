import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createMentorRequest, listMentors, MAX_MENTOR_TARGETS } from "@/lib/mentoring"
import { listStartups, type Startup } from "@/lib/startups"

export function RequestMentorPage() {
  const { id } = useParams<{ id: string }>()
  const startupId = Number(id)
  const navigate = useNavigate()

  const [idea, setIdea] = useState<Startup | null>(null)
  const [mentors, setMentors] = useState<{ userId: string; firstName: string; lastName: string; department: string | null }[] | null>(
    null,
  )
  const [selectedMentorIds, setSelectedMentorIds] = useState<Set<string>>(new Set())
  const [requiredSkills, setRequiredSkills] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const toggleMentor = (userId: string) => {
    setSelectedMentorIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else if (next.size < MAX_MENTOR_TARGETS) {
        next.add(userId)
      }
      return next
    })
  }

  useEffect(() => {
    listStartups()
      .then((all) => setIdea(all.find((s) => s.startupId === startupId) ?? null))
      .catch(() => setIdea(null))
    listMentors()
      .then(setMentors)
      .catch(() => setMentors(null))
  }, [startupId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await createMentorRequest(startupId, {
        requiredSkills: requiredSkills || null,
        requestDescription: description || null,
        mentorIds: Array.from(selectedMentorIds),
      })
      navigate(`/dashboard/ideas/${startupId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

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
          <p className="text-sm uppercase tracking-[0.2em] text-white/80 font-medium mb-4">Mentorship</p>
          <h1 className="font-serif text-4xl lg:text-5xl text-white text-balance mb-4">
            {idea ? idea.startupName : "Loading..."}
          </h1>
          <p className="text-white/90 leading-relaxed">Ask for a mentor to guide this idea forward.</p>
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
        <div>
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Request a mentor</CardTitle>
              <CardDescription>
                Pick up to {MAX_MENTOR_TARGETS} mentors, or leave none selected to broadcast to every mentor's inbox.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="requiredSkills">Skills you're looking for (optional)</Label>
                  <Input
                    id="requiredSkills"
                    placeholder="e.g. Go-to-market, fundraising, hardware"
                    value={requiredSkills}
                    onChange={(e) => setRequiredSkills(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">What do you need help with? (optional)</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    placeholder="Give a mentor enough context to decide if they're a fit."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="rounded-full" disabled={submitting}>
                  {submitting ? "Sending..." : "Send request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-10 self-start">
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Suggested Mentors (smart select coming soon)</CardTitle>
              <CardDescription>
                Tick up to {MAX_MENTOR_TARGETS} to request them directly ({selectedMentorIds.size}/{MAX_MENTOR_TARGETS}{" "}
                selected).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mentors && mentors.length === 0 && (
                <p className="text-sm text-muted-foreground">No mentors have joined yet.</p>
              )}
              {mentors?.map((m) => {
                const checked = selectedMentorIds.has(m.userId)
                const disabled = !checked && selectedMentorIds.size >= MAX_MENTOR_TARGETS
                return (
                  <label
                    key={m.userId}
                    className={`flex items-center gap-3 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}
                  >
                    <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggleMentor(m.userId)} />
                    <div>
                      <p className="font-medium">
                        {m.firstName} {m.lastName}
                      </p>
                      {m.department && <p className="text-muted-foreground">{m.department}</p>}
                    </div>
                  </label>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
