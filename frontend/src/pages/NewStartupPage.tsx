import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Layout } from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/AuthContext"
import { apiFetch } from "@/lib/api"

export function NewStartupPage() {
  const { profile, loading: authLoading } = useAuth()
  const [startupName, setStartupName] = useState("")
  const [domain, setDomain] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await apiFetch("/api/startups", {
        method: "POST",
        body: JSON.stringify({ startup_name: startupName, domain: domain || null, description: description || null }),
      })
      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Layout>
      <main className="relative min-h-screen flex items-center justify-center px-6 pt-32 pb-80 overflow-hidden">
        {/* Same wildflower-valley imagery as the landing page footer, for continuity */}
        <img
          src="/images/footer-bg.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />

        {authLoading ? null : !profile ? (
          <p className="relative z-10 text-muted-foreground">
            You need to be signed in as a founder to submit an idea.
          </p>
        ) : (
          <Card className="relative z-10 w-full max-w-lg">
            <CardHeader>
              <CardTitle className="font-serif text-3xl">Submit your idea</CardTitle>
              <CardDescription>Tell us what you're building, {profile.firstName}.</CardDescription>
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

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit idea"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </Layout>
  )
}
