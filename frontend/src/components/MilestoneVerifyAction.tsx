import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { verifyMilestone } from "@/lib/milestones"

export function MilestoneVerifyAction({
  startupId,
  milestoneId,
  onDone,
}: {
  startupId: number
  milestoneId: number
  onDone: () => void
}) {
  const [mode, setMode] = useState<"idle" | "verify" | "reject">("idle")
  const [remarks, setRemarks] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (mode === "idle") {
    return (
      <div className="flex gap-2">
        <Button size="sm" className="rounded-full cursor-pointer" onClick={() => setMode("verify")}>
          Verify
        </Button>
        <Button size="sm" variant="outline" className="rounded-full cursor-pointer" onClick={() => setMode("reject")}>
          Reject
        </Button>
      </div>
    )
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await verifyMilestone(startupId, milestoneId, {
        verificationStatus: mode === "verify" ? "verified" : "rejected",
        remarks: remarks || null,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full space-y-2">
      <Textarea
        rows={2}
        placeholder={mode === "verify" ? "Add remarks (optional)" : "Why is this being rejected? (optional)"}
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" className="rounded-full cursor-pointer" disabled={busy} onClick={confirm}>
          {busy ? "Saving..." : mode === "verify" ? "Confirm verification" : "Confirm rejection"}
        </Button>
        <button
          type="button"
          onClick={() => setMode("idle")}
          className="text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
