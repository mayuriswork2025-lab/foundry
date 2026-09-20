import { useState, type FormEvent } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Layout } from "@/components/Layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/context/AuthContext"
import { ApiError } from "@/lib/api"

type Role = "founder" | "mentor"
type Mode = "signup" | "login"

function isRole(value: string | null): value is Role {
  return value === "founder" || value === "mentor"
}

function isMode(value: string | null): value is Mode {
  return value === "signup" || value === "login"
}

export function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const role: Role = isRole(searchParams.get("role")) ? (searchParams.get("role") as Role) : "founder"
  const mode: Mode = isMode(searchParams.get("mode")) ? (searchParams.get("mode") as Mode) : "signup"

  const setMode = (next: Mode) => {
    const params = new URLSearchParams(searchParams)
    params.set("mode", next)
    setSearchParams(params, { replace: true })
  }

  const setRole = (next: Role) => {
    const params = new URLSearchParams(searchParams)
    params.set("role", next)
    setSearchParams(params, { replace: true })
  }

  return (
    <Layout>
      <main className="relative min-h-screen flex items-center justify-center px-6 pt-32 pb-80 overflow-hidden">
        {/* Same wildflower-valley imagery as the landing page footer, for continuity */}
        <img
          src="/images/hero-bg.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />

        <Card className="relative z-10 w-full max-w-md">
          <CardHeader>
            <CardTitle className="font-serif text-3xl">Welcome to Foundry</CardTitle>
            <CardDescription>
              {mode === "signup"
                ? role === "founder"
                  ? "Create an account, then submit your idea."
                  : "Create an account, then start guiding startups."
                : "Log back in to pick up where you left off."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signup">Sign up</TabsTrigger>
                <TabsTrigger value="login">Log in</TabsTrigger>
              </TabsList>

              <TabsContent value="signup">
                <div className="mb-6 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={role === "founder" ? "default" : "outline"}
                    onClick={() => setRole("founder")}
                  >
                    I have an idea
                  </Button>
                  <Button
                    type="button"
                    variant={role === "mentor" ? "default" : "outline"}
                    onClick={() => setRole("mentor")}
                  >
                    I'll mentor
                  </Button>
                </div>
                <SignupForm role={role} />
              </TabsContent>

              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </Layout>
  )
}

function SignupForm({ role }: { role: Role }) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const { signup } = useAuth()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await signup({ email, password, firstName, lastName, role })
      navigate(role === "founder" ? "/startups/new" : "/mentor")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signupEmail">Email</Label>
        <Input id="signupEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signupPassword">Password</Label>
        <Input
          id="signupPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating account..." : role === "founder" ? "Submit your idea" : "Start guiding startups"}
      </Button>
    </form>
  )
}

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const { login } = useAuth()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const profile = await login(email, password)
      navigate(profile.roleName === "mentor" ? "/mentor" : "/startups/new")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="loginEmail">Email</Label>
        <Input id="loginEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loginPassword">Password</Label>
        <Input
          id="loginPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Logging in..." : "Log in"}
      </Button>
    </form>
  )
}
