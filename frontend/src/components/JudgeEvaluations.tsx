import { useEffect, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { listMyEvaluations, submitEvaluation, type Evaluation } from "@/lib/demoDay"

const SCORE_FIELDS = [
  ["innovationScore", "Innovation"],
  ["technicalScore", "Technical"],
  ["businessScore", "Business"],
  ["presentationScore", "Presentation"],
] as const

export function JudgeEvaluations() {
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    listMyEvaluations()
      .then(setEvaluations)
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."))
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>, evaluation: Evaluation) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const score = (key: string) => Number(form.get(key))
    setBusyId(evaluation.evaluationId)
    setError(null)
    try {
      const updated = await submitEvaluation(evaluation.evaluationId, {
        innovationScore: score("innovationScore"),
        technicalScore: score("technicalScore"),
        businessScore: score("businessScore"),
        presentationScore: score("presentationScore"),
        overallRemarks: (form.get("overallRemarks") as string) || null,
      })
      setEvaluations((prev) => prev.map((e) => (e.evaluationId === updated.evaluationId ? updated : e)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mt-12">
      <h2 className="font-serif text-2xl mb-1">Startups to score</h2>
      <p className="text-muted-foreground text-sm mb-6">Score each startup from 0 to 10 on every criterion.</p>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      {evaluations.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No startups assigned to you yet.</p>
        </div>
      )}

      <div className="grid gap-4">
        {evaluations.map((evaluation) => (
          <form
            key={evaluation.evaluationId}
            onSubmit={(e) => handleSubmit(e, evaluation)}
            className="p-6 rounded-3xl border border-border space-y-4"
          >
            <div>
              <h3 className="text-lg font-medium">{evaluation.startupName}</h3>
              <p className="text-sm text-muted-foreground">
                {evaluation.eventName} · {new Date(evaluation.eventDate).toLocaleDateString()}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {SCORE_FIELDS.map(([key, label]) => (
                <label key={key} className="text-sm space-y-1">
                  <span className="text-muted-foreground">{label}</span>
                  <Input
                    name={key}
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    required
                    defaultValue={evaluation[key] ?? ""}
                  />
                </label>
              ))}
            </div>
            <Textarea
              name="overallRemarks"
              placeholder="Overall remarks"
              defaultValue={evaluation.overallRemarks ?? ""}
            />
            <Button type="submit" className="rounded-full cursor-pointer" disabled={busyId === evaluation.evaluationId}>
              {busyId === evaluation.evaluationId
                ? "Saving..."
                : evaluation.innovationScore === null
                  ? "Submit scores"
                  : "Update scores"}
            </Button>
          </form>
        ))}
      </div>
    </div>
  )
}
