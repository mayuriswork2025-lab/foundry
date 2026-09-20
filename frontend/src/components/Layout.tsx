import type { ReactNode } from "react"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"

/**
 * Shared shell for every non-landing page (auth, dashboards, forms) — keeps
 * the navbar and footer present everywhere so people can get back to the
 * rest of the site instead of getting stranded on a bare form.
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      {children}
      <Footer />
    </div>
  )
}
