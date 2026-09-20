import type React from "react"
import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"

import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { api, type Startup, type StartupMilestoneInsight, type StartupStageCount } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign in"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Create a user under Supabase Dashboard → Authentication → Add user, then sign in here.
      </p>
    </form>
  )
}

function CreateStartupForm({ onCreated }: { onCreated: () => void }) {
  const [startupName, setStartupName] = useState("")
  const [domain, setDomain] = useState("")
  const [currentStage, setCurrentStage] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.createStartup({
        startupName,
        domain: domain || undefined,
        currentStage: currentStage || undefined,
      })
      setStartupName("")
      setDomain("")
      setCurrentStage("")
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create startup.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-start">
      <Input
        placeholder="Startup name"
        value={startupName}
        onChange={(e) => setStartupName(e.target.value)}
        required
        className="max-w-48"
      />
      <Input
        placeholder="Domain (e.g. FinTech)"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        className="max-w-48"
      />
      <Input
        placeholder="Stage (e.g. Idea, MVP)"
        value={currentStage}
        onChange={(e) => setCurrentStage(e.target.value)}
        className="max-w-48"
      />
      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add startup"}
      </Button>
      {error && <p className="text-sm text-destructive w-full">{error}</p>}
    </form>
  )
}

function StartupsTable({ startups, onChanged }: { startups: Startup[]; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleStatusChange = async (startupId: number, registrationStatus: string) => {
    setBusyId(startupId)
    setError(null)
    try {
      await api.updateStartup(startupId, { registrationStatus })
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.")
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (startupId: number) => {
    setBusyId(startupId)
    setError(null)
    try {
      await api.deleteStartup(startupId)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.")
    } finally {
      setBusyId(null)
    }
  }

  if (startups.length === 0) {
    return <p className="text-sm text-muted-foreground">No startups yet — add one above.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Registered</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {startups.map((s) => (
            <TableRow key={s.startupId}>
              <TableCell className="font-medium">{s.startupName}</TableCell>
              <TableCell>{s.domain ?? "—"}</TableCell>
              <TableCell>{s.currentStage ?? "—"}</TableCell>
              <TableCell>
                <select
                  className="text-xs border rounded px-1 py-0.5 bg-background"
                  value={s.registrationStatus ?? "pending"}
                  disabled={busyId === s.startupId}
                  onChange={(e) => handleStatusChange(s.startupId, e.target.value)}
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </TableCell>
              <TableCell>{s.registrationDate ?? "—"}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId === s.startupId}
                  onClick={() => handleDelete(s.startupId)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

export function StartupsDashboard() {
  const [session, setSession] = useState<Session | null>(null)
  const [startups, setStartups] = useState<Startup[]>([])
  const [stageCounts, setStageCounts] = useState<StartupStageCount[]>([])
  const [insights, setInsights] = useState<StartupMilestoneInsight[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const refresh = () => {
    setLoadError(null)
    Promise.all([api.listStartups(), api.getStageCounts(), api.getAboveAverageMilestoneStartups()])
      .then(([startupsRes, statsRes, insightsRes]) => {
        setStartups(startupsRes)
        setStageCounts(statsRes)
        setInsights(insightsRes)
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load data."))
  }

  useEffect(() => {
    if (session) refresh()
  }, [session])

  return (
    <section id="dashboard" className="max-w-5xl mx-auto px-4 pt-32 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Startups dashboard</h2>
          <p className="text-sm text-muted-foreground">Live data from the FastAPI backend.</p>
        </div>
        {session && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
            <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        )}
      </div>

      {!isSupabaseConfigured ? (
        <p className="text-sm text-muted-foreground max-w-md">
          Supabase isn't configured yet — set{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> in{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">frontend/.env</code> to enable
          sign-in.
        </p>
      ) : !session ? (
        <LoginForm />
      ) : (
        <div className="flex flex-col gap-8">
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Register a startup</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateStartupForm onCreated={refresh} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Startups ({startups.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <StartupsTable startups={startups} onChanged={refresh} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Startups per stage</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {stageCounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                )}
                {stageCounts.map((row) => (
                  <Badge key={row.currentStage ?? "none"} variant="secondary">
                    {row.currentStage ?? "Unset"}: {row.startupCount}
                  </Badge>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Above-average milestone activity</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1">
                {insights.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No startup currently has more milestones than average.
                  </p>
                )}
                {insights.map((row) => (
                  <div key={row.startupId} className="flex justify-between text-sm">
                    <span>{row.startupName}</span>
                    <span className="text-muted-foreground">{row.milestoneCount} milestones</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  )
}
