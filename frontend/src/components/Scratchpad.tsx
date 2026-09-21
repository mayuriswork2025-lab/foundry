import { useState } from "react"
import ReactMarkdown from "react-markdown"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { useScratchpad } from "@/hooks/useScratchpad"

export function Scratchpad({ storageKey }: { storageKey: string }) {
  const [notes, setNotes] = useScratchpad(storageKey)
  const [tab, setTab] = useState<"write" | "preview">("write")

  return (
    <Card className="rounded-2xl shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Scratchpad</CardTitle>
            <CardDescription>Just for you — not saved to this idea.</CardDescription>
          </div>
          <div className="flex items-center rounded-full border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab("write")}
              className={cn(
                "px-3 py-1 rounded-full cursor-pointer transition-colors",
                tab === "write" ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              className={cn(
                "px-3 py-1 rounded-full cursor-pointer transition-colors",
                tab === "preview" ? "bg-foreground text-background" : "text-muted-foreground",
              )}
            >
              Preview
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tab === "write" ? (
          <Textarea
            rows={12}
            placeholder="Jot down notes while you work... (markdown supported)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="font-mono text-sm"
          />
        ) : (
          <div className="min-h-[15rem] text-sm space-y-3 [&_h1]:font-serif [&_h1]:text-xl [&_h2]:font-serif [&_h2]:text-lg [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded">
            {notes.trim() ? (
              <ReactMarkdown>{notes}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground">Nothing here yet — write some notes to preview them.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
