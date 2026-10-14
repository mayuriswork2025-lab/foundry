export function ClaudeIcon({ className }: { className?: string }) {
  // A simplified sunburst approximating Claude's mark — not an exact
  // reproduction of the brand asset, just enough to read as "Claude" next
  // to the export button.
  const rays = Array.from({ length: 12 })

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {rays.map((_, i) => {
        const angle = (i * 360) / rays.length
        return (
          <rect
            key={i}
            x="11.1"
            y="2"
            width="1.8"
            height="7"
            rx="0.9"
            fill="currentColor"
            transform={`rotate(${angle} 12 12)`}
          />
        )
      })}
    </svg>
  )
}
