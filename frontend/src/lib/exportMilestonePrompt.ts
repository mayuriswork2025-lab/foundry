import type { Meeting } from "@/lib/meetings"
import type { Milestone } from "@/lib/milestones"

/** Compiles a milestone + its meetings (discussion, action items, comments) into one prompt-ready block of text. */
export function buildMilestonePrompt(startupName: string, milestone: Milestone, meetings: Meeting[]): string {
  const lines: string[] = []

  lines.push(`I'm working on a milestone for my startup "${startupName}" and want help thinking it through.`)
  lines.push(`Here's the full context:\n`)

  lines.push(`## Milestone: ${milestone.milestoneName}`)
  lines.push(`- Status: ${milestone.status ?? "unknown"}`)
  lines.push(`- Due date: ${milestone.dueDate ?? "not set"}`)
  if (milestone.status === "completed") {
    lines.push(`- Verification: ${milestone.verificationStatus ?? "unverified"}`)
  }
  lines.push("")
  lines.push("Description:")
  lines.push(milestone.description || "No description.")

  if (milestone.mentorRemarks) {
    lines.push("")
    lines.push("Mentor remarks:")
    lines.push(milestone.mentorRemarks)
  }

  lines.push("")
  lines.push(`## Meetings (${meetings.length})`)

  if (meetings.length === 0) {
    lines.push("No meetings scheduled yet.")
  }

  for (const meeting of meetings) {
    const when = new Date(meeting.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    lines.push("")
    lines.push(`### ${meeting.agenda || "Untitled meeting"} — ${when} (${meeting.status})`)
    lines.push("Discussion:")
    lines.push(meeting.discussion || "No notes yet.")

    lines.push("")
    lines.push("Action items:")
    if (meeting.actionItems.length === 0) {
      lines.push("None.")
    } else {
      for (const item of meeting.actionItems) {
        lines.push(`- [${item.isDone ? "x" : " "}] ${item.itemText}`)
      }
    }

    lines.push("")
    lines.push("Comments:")
    if (meeting.comments.length === 0) {
      lines.push("None.")
    } else {
      for (const comment of meeting.comments) {
        const commentWhen = new Date(comment.createdAt).toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short",
        })
        lines.push(`- ${comment.authorFirstName} ${comment.authorLastName} (${commentWhen}): ${comment.body}`)
      }
    }
  }

  lines.push("")
  lines.push("---")
  lines.push("Please review this and help me think through what to focus on next.")

  return lines.join("\n")
}
