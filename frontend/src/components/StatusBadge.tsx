import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  pending: "bg-amber-100 text-amber-800 border-transparent",
  approved: "bg-emerald-100 text-emerald-800 border-transparent",
  rejected: "bg-red-100 text-red-800 border-transparent",
  invited: "bg-blue-100 text-blue-800 border-transparent",
  accepted: "bg-emerald-100 text-emerald-800 border-transparent",
  in_progress: "bg-blue-100 text-blue-800 border-transparent",
  completed: "bg-emerald-100 text-emerald-800 border-transparent",
  unverified: "bg-amber-100 text-amber-800 border-transparent",
  verified: "bg-emerald-100 text-emerald-800 border-transparent",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  invited: "Invited",
  accepted: "Accepted",
  in_progress: "In progress",
  completed: "Completed",
  unverified: "Needs verification",
  verified: "Verified",
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <Badge className={STATUS_STYLES[status] ?? ""}>{STATUS_LABELS[status] ?? status}</Badge>
  )
}
