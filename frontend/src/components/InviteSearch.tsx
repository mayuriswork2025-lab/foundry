import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { searchFounders, type UserSummary } from "@/lib/startups"

export function InviteSearch({
  onInvite,
  disabled,
}: {
  onInvite: (founder: UserSummary) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    const handle = setTimeout(() => {
      searchFounders(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="rounded-full" disabled={disabled}>
          <Search className="w-3.5 h-3.5" />
          Invite
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search founders by name or email..." value={query} onValueChange={setQuery} />
          <CommandList>
            {!loading && query.trim().length >= 2 && results.length === 0 && (
              <CommandEmpty>No founders found.</CommandEmpty>
            )}
            <CommandGroup>
              {results.map((founder) => (
                <CommandItem
                  key={founder.userId}
                  value={founder.userId}
                  onSelect={() => {
                    onInvite(founder)
                    setOpen(false)
                    setQuery("")
                    setResults([])
                  }}
                >
                  <div className="flex flex-col">
                    <span>
                      {founder.firstName} {founder.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">{founder.email}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
