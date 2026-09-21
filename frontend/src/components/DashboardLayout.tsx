import { useEffect, useState, type ComponentType } from "react"
import { Link, Navigate, Outlet, useLocation } from "react-router-dom"
import { BellRing, ChevronLeft, ChevronRight, Compass, Inbox, LayoutGrid, LogOut, SquarePen } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"
import { listMilestoneNotifications } from "@/lib/milestones"

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
}

// More items land here later: "Mentors", etc.
const founderNavItems: NavItem[] = [
  { label: "Draft an idea", to: "/dashboard/ideas/new", icon: SquarePen },
  { label: "My ideas", to: "/dashboard", icon: LayoutGrid },
  { label: "Milestones", to: "/dashboard/milestones", icon: BellRing },
]

// More items land here later: team chat, etc.
const mentorNavItems: NavItem[] = [
  { label: "Guiding Startups", to: "/dashboard/guiding", icon: Compass },
  { label: "Browse ideas", to: "/dashboard", icon: LayoutGrid },
  { label: "Mentor Requests", to: "/dashboard/inbox", icon: Inbox },
]

export function DashboardLayout() {
  const location = useLocation()
  const { profile, loading, signOut } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [milestoneCount, setMilestoneCount] = useState(0)

  useEffect(() => {
    if (!profile) return
    listMilestoneNotifications()
      .then((rows) => setMilestoneCount(rows.length))
      .catch(() => setMilestoneCount(0))
  }, [profile])

  if (loading) return null
  if (!profile) return <Navigate to="/auth" replace />

  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase()
  const navItems = profile.roleName === "mentor" ? mentorNavItems : founderNavItems

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          "shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex items-center justify-between px-4 py-6">
          <Link to="/" className={cn("flex items-center gap-2 min-w-0", collapsed && "justify-center flex-1")}>
            <svg
              className="w-6 h-6 shrink-0 text-sidebar-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {!collapsed && (
              <span className="font-serif text-lg tracking-tight text-sidebar-foreground truncate">Foundry</span>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
              className="shrink-0 text-muted-foreground hover:text-sidebar-foreground cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            className="mx-auto mb-2 text-muted-foreground hover:text-sidebar-foreground cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        <nav className="flex-1 px-4 space-y-1">
          {!collapsed && (
            <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Menu</p>
          )}
          {navItems.map((item) => {
            const isActive = location.pathname === item.to
            const badge = item.to === "/dashboard/milestones" ? milestoneCount : 0
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && (
                  <span className="flex-1 flex items-center justify-between">
                    {item.label}
                    {badge > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none",
                          isActive ? "bg-sidebar-primary-foreground/20" : "bg-amber-100 text-amber-800",
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </span>
                )}
                {collapsed && badge > 0 && (
                  <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className={cn("px-4 py-5 flex items-center gap-3", collapsed && "justify-center px-0")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile.firstName} {profile.lastName}{" "}
                  <span className="text-muted-foreground font-normal capitalize">· {profile.roleName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                className="shrink-0 text-muted-foreground hover:text-sidebar-foreground cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
        {collapsed && (
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="mx-auto mb-5 text-muted-foreground hover:text-sidebar-foreground cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </aside>

      <main className="relative flex-1 overflow-y-auto flex flex-col">
        <img
          src="/images/hero-bg.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.08] grayscale pointer-events-none"
        />
        <div className="relative z-10 flex-1">
          <Outlet />
        </div>
        {/* <footer className="relative z-10 border-t border-border px-10 py-8 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="font-serif text-lg text-foreground">Foundry</span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">© 2026 Foundry. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">Turning bold ideas into real startups.</p>
          </div>
        </footer> */}
      </main>
    </div>
  )
}
