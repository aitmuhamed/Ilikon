'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronLeft,
  ExternalLink,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/primitives'
import { useI18n } from '@/components/providers'
import { apiFetch } from '@/lib/client-api'
import { cn } from '@/lib/utils'

export interface AdminNavItem {
  href: string
  label: string
  icon: string
  badge?: number
  badgeTone?: 'danger' | 'warning' | 'brand'
}

export interface AdminNavGroup {
  title: string
  items: AdminNavItem[]
}

/** Icon registry — the server passes a name, not a component. */
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Package,
  Percent,
  Settings,
  ShoppingCart,
  Star,
  Tag,
  Truck,
  Users,
  UserCog,
  History,
  Building2,
  Stethoscope,
} from 'lucide-react'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  orders: ShoppingCart,
  products: Package,
  categories: Boxes,
  brands: Building2,
  inventory: ClipboardList,
  customers: Users,
  prescriptions: FileText,
  coupons: Tag,
  promotions: Percent,
  reviews: Star,
  delivery: Truck,
  payments: CreditCard,
  chatbot: MessageCircle,
  consultations: Stethoscope,
  notifications: Bell,
  reports: BarChart3,
  staff: UserCog,
  roles: ShieldCheck,
  settings: Settings,
  audit: History,
}

export function AdminShell({
  groups,
  user,
  unread,
  pharmacyName,
  storefrontHref,
  children,
}: {
  groups: AdminNavGroup[]
  user: { fullName: string; roleName: string; jobTitle: string | null }
  unread: number
  pharmacyName: string
  storefrontHref: string
  children: React.ReactNode
}) {
  const { d } = useI18n()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [loggingOut, setLoggingOut] = React.useState(false)

  React.useEffect(() => setMobileOpen(false), [pathname])

  async function logout() {
    setLoggingOut(true)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = storefrontHref
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-ink-800/60 px-4">
        {/* The logo is the way back to the dashboard, as it is in every admin
            panel. The storefront has its own link in the header below. */}
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          aria-label={d.admin.dashboard}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
              <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z" fill="currentColor" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{pharmacyName}</p>
            <p className="text-[10px] uppercase tracking-wider text-ink-400">{d.admin.title}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="ml-auto rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 lg:hidden"
          aria-label={d.common.close}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3 scroll-thin">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard
                const active =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        active
                          ? 'bg-brand-500/15 font-semibold text-brand-300'
                          : 'text-ink-300 hover:bg-ink-800/70 hover:text-white',
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-400' : 'text-ink-500')} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && item.badge > 0 ? (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                            item.badgeTone === 'danger'
                              ? 'bg-danger text-white'
                              : item.badgeTone === 'warning'
                                ? 'bg-warning text-white'
                                : 'bg-brand-500 text-white',
                          )}
                        >
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-ink-800/60 p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-ink-800/60 p-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-bold text-brand-300">
            {user.fullName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{user.fullName}</p>
            <p className="truncate text-[10px] text-ink-400">{user.jobTitle ?? user.roleName}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Link
            href={storefrontHref}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink-800/60 px-2 py-2 text-[11px] font-medium text-ink-300 transition-colors hover:bg-ink-800 hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            {d.admin.viewSite}
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex items-center justify-center rounded-lg bg-ink-800/60 px-2.5 py-2 text-ink-400 transition-colors hover:bg-red-500/20 hover:text-red-300"
            aria-label={d.nav.logout}
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-ink-900 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-900/60" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative z-10 h-full w-[82%] max-w-xs animate-slide-in-right bg-ink-900">
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-2 rounded-lg p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
            aria-label={d.nav.menu}
          >
            <Menu className="h-5 w-5" />
          </button>

          <AdminSearch />

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/admin/notifications"
              className="relative rounded-lg p-2.5 text-ink-600 transition-colors hover:bg-ink-100"
              aria-label={d.admin.notifications}
            >
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              ) : null}
            </Link>

            <div className="hidden items-center gap-2 rounded-lg border border-ink-200 px-2.5 py-1.5 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
                {user.fullName.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-xs">
                <span className="block font-semibold leading-tight text-ink-900">
                  {user.fullName.split(' ')[0]}
                </span>
                <span className="block leading-tight text-ink-400">{user.roleName}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  )
}

/** Jump straight to an order or product by number / SKU. */
function AdminSearch() {
  const { d } = useI18n()
  const [term, setTerm] = React.useState('')

  return (
    <form
      className="relative hidden max-w-sm flex-1 sm:block"
      onSubmit={(event) => {
        event.preventDefault()
        const value = term.trim()
        if (!value) return
        // ILK-… is unmistakably an order number; anything else is a product.
        window.location.href = value.toUpperCase().startsWith('ILK-')
          ? `/admin/orders?q=${encodeURIComponent(value)}`
          : `/admin/products?q=${encodeURIComponent(value)}`
      }}
    >
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        aria-hidden
      />
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={`${d.admin.orderNumber} / SKU…`}
        className="h-10 w-full rounded-lg border border-ink-200 bg-ink-50/70 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        aria-label={d.admin.searchPlaceholder}
      />
    </form>
  )
}

// ─────────────────────────── page scaffolding ─────────────────────────────

export function AdminPageHeader({
  title,
  subtitle,
  backHref,
  actions,
  badge,
}: {
  title: string
  subtitle?: string
  backHref?: string
  actions?: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {backHref ? (
          <Link
            href={backHref}
            className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-ink-500 transition-colors hover:text-brand-700"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            {title}
          </Link>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h1>
          {badge}
        </div>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  tone = 'default',
  icon,
  href,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'accent'
  icon?: React.ReactNode
  href?: string
}) {
  const tones = {
    default: 'border-ink-200',
    brand: 'border-brand-200 bg-brand-50/40',
    success: 'border-green-200 bg-green-50/40',
    warning: 'border-amber-200 bg-amber-50/50',
    danger: 'border-red-200 bg-red-50/50',
    accent: 'border-accent-200 bg-accent-50/40',
  }
  const iconTones = {
    default: 'bg-ink-100 text-ink-500',
    brand: 'bg-brand-100 text-brand-600',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-amber-100 text-amber-600',
    danger: 'bg-red-100 text-red-600',
    accent: 'bg-accent-100 text-accent-600',
  }

  const body = (
    <div className={cn('rounded-card border bg-white p-4 shadow-card transition-shadow', tones[tone], href && 'hover:shadow-card-hover')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink-500">{label}</p>
          <p className="mt-1 text-xl font-extrabold text-ink-900 tabular sm:text-2xl">{value}</p>
          {sub ? <p className="mt-0.5 truncate text-[11px] text-ink-400">{sub}</p> : null}
        </div>
        {icon ? (
          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconTones[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  )

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  )
}

export { Badge }
