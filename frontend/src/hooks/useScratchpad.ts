import { useState } from "react"

/** Plain localStorage — deliberately never touches the backend. */
export function useScratchpad(key: string) {
  const storageKey = `scratchpad:${key}`
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(storageKey) ?? ""
    } catch {
      return ""
    }
  })

  const update = (next: string) => {
    setValue(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // best-effort only — the scratchpad isn't meant to be durable
    }
  }

  return [value, update] as const
}
