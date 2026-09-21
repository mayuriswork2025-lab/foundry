import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Scratchpad } from "@/components/Scratchpad"
import { useAuth } from "@/context/AuthContext"
import { createStartup, listStartups, updateStartup } from "@/lib/startups"

export function IdeaFormPage() {
  const { profile } = useAuth()
  const { id } = useParams<{ id: string }>()
  const isEdit = id != null
  const startupId = isEdit ? Number(id) : null

  const [startupName, setStartupName] = useState("")
  const [domain, setDomain] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  const navigate = useNavigate()

  useEffect(() => {
    if (startupId == null) return
    listStartups()
      .then((all) => {
        const found = all.find((s) => s.startupId === startupId)
        if (found) {
          setStartupName(found.startupName)
          setDomain(found.domain ?? "")
          setDescription(found.description ?? "")
        } else {
          setError("This idea doesn't exist.")
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
      .finally(() => setLoading(false))
  }, [startupId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const payload = { startupName, domain: domain || null, description: description || null }
      const startup =
        startupId != null ? await updateStartup(startupId, payload) : await createStartup(payload)
      navigate(`/dashboard/ideas/${startup.startupId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return null

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
          <p className="text-white/90 leading-relaxed">
            Ready to move your idea forward? Fill in the basics below and we'll get it in front of mentors.
          </p>
        </div>
      </div>

      <div className="px-10 mb-6">
        <h2 className="font-serif text-2xl mb-1">{isEdit ? "Edit your idea" : "Draft an idea"}</h2>
        <p className="text-muted-foreground text-sm">
          {isEdit
            ? "Update the basics — changes save immediately."
            : "This saves as a draft — only you can see it until you submit it."}
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 px-10">
        <div>
          <Card className="rounded-2xl shadow-none">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Idea details</CardTitle>
              <CardDescription>The basics — you can add more later.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="startupName">Startup name</Label>
                  <Input
                    id="startupName"
                    value={startupName}
                    onChange={(e) => setStartupName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    placeholder="e.g. CleanTech, FinTech, HealthTech"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    placeholder="What problem are you solving?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="rounded-full" disabled={submitting}>
                  {submitting ? "Saving..." : isEdit ? "Save changes" : "Save draft"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-10 self-start">
          <Scratchpad storageKey={isEdit ? `idea-${startupId}` : "new-idea"} />
        </div>
      </div>
    </div>
  )
}
