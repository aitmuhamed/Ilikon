'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronDown,
  FileText,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Stethoscope,
  Truck,
  User,
  X,
} from 'lucide-react'

import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { SearchBar } from './search-bar'
import { LanguageSwitcher } from './language-switcher'
import { Badge } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/client-api'
import { cn } from '@/lib/utils'
import type { CategoryNode } from '@/lib/products'

export interface HeaderUser {
  id: string
  fullName: string
  isStaff: boolean
  hasAdminAccess: boolean
  unreadNotifications: number
}

export function Header({
  categories,
  user,
  phone,
  workingHours,
  deliveryNote,
}: {
  categories: CategoryNode[]
  user: HeaderUser | null
  phone: string
  workingHours: string
  deliveryNote: string
}) {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const pathname = usePathname()
  const cart = useCartCount()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [categoriesOpen, setCategoriesOpen] = React.useState(false)
  const [userMenuOpen, setUserMenuOpen] = React.useState(false)

  // Any navigation closes every overlay — nothing should survive a route change.
  React.useEffect(() => {
    setMobileOpen(false)
    setCategoriesOpen(false)
    setUserMenuOpen(false)
  }, [pathname])

  const navLinks = [
    { href: '/', label: d.nav.home },
    { href: '/products', label: d.nav.products },
    { href: '/categories', label: d.nav.categories },
    { href: '/consultation', label: d.consultation.navLabel },
    { href: '/prescriptions/upload', label: d.nav.prescriptionUpload },
    { href: '/about', label: d.nav.about },
    { href: '/contact', label: d.nav.contact },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      {/* Trust strip */}
      <div className="hidden bg-brand-700 text-white lg:block">
        <div className="container-page flex h-9 items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {d.home.trustLicensed}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5" aria-hidden />
              {deliveryNote}
            </span>
          </div>
          <div className="flex items-center gap-5">
            <span className="opacity-90">{workingHours}</span>
            <a href={`tel:${phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {phone}
            </a>
          </div>
        </div>
      </div>

      <div className="container-page">
        <div className="flex h-16 items-center gap-3 lg:gap-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-2 rounded-lg p-2 text-ink-600 transition-colors hover:bg-ink-100 lg:hidden"
            aria-label={d.nav.menu}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href={localePath('/')} className="flex shrink-0 items-center gap-2.5">
            <Logo />
            <span className="hidden leading-none sm:block">
              <span className="block text-lg font-extrabold tracking-tight text-brand-700">
                {d.meta.siteName}
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">
                {d.meta.siteTagline}
              </span>
            </span>
          </Link>

          <div className="hidden min-w-0 flex-1 lg:block">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-1.5 lg:gap-2">
            <LanguageSwitcher compact />

            <Link
              href={localePath('/account/wishlist')}
              className="hidden rounded-lg p-2.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-brand-700 sm:block"
              aria-label={d.nav.wishlist}
            >
              <Heart className="h-5 w-5" />
            </Link>

            {user ? (
              <Link
                href={localePath('/account/notifications')}
                className="relative hidden rounded-lg p-2.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-brand-700 sm:block"
                aria-label={d.nav.notifications}
              >
                <Bell className="h-5 w-5" />
                {user.unreadNotifications > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {user.unreadNotifications > 9 ? '9+' : user.unreadNotifications}
                  </span>
                ) : null}
              </Link>
            ) : null}

            <Link
              href={localePath('/cart')}
              className="relative rounded-lg p-2.5 text-ink-600 transition-colors hover:bg-ink-100 hover:text-brand-700"
              aria-label={`${d.nav.cart} (${cart.count})`}
            >
              <ShoppingCart className="h-5 w-5" />
              {cart.count > 0 ? (
                <span className="absolute right-1 top-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
                  {cart.count > 99 ? '99+' : cart.count}
                </span>
              ) : null}
            </Link>

            {user ? (
              <UserMenu
                user={user}
                open={userMenuOpen}
                setOpen={setUserMenuOpen}
              />
            ) : (
              <div className="flex items-center gap-2">
                <Link href={localePath('/login')} className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    {d.nav.login}
                  </Button>
                </Link>
                <Link href={localePath('/register')}>
                  <Button size="sm">{d.nav.register}</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile search row */}
        <div className="pb-3 lg:hidden">
          <SearchBar />
        </div>

        {/* Desktop nav */}
        <nav className="hidden h-11 items-center gap-1 lg:flex" aria-label="Main">
          <div className="relative">
            <button
              type="button"
              onClick={() => setCategoriesOpen((v) => !v)}
              onMouseEnter={() => setCategoriesOpen(true)}
              aria-expanded={categoriesOpen}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
            >
              <Menu className="h-4 w-4" aria-hidden />
              {d.nav.categories}
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', categoriesOpen && 'rotate-180')} aria-hidden />
            </button>

            {categoriesOpen ? (
              <div
                onMouseLeave={() => setCategoriesOpen(false)}
                className="absolute left-0 top-full z-50 mt-1 w-[640px] rounded-xl border border-ink-200 bg-white p-3 shadow-pop"
              >
                <div className="grid grid-cols-3 gap-1">
                  {categories.slice(0, 18).map((category) => (
                    <Link
                      key={category.id}
                      href={localePath(`/categories/${category.slug}`)}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      <span className="truncate">{category.name}</span>
                      <span className="shrink-0 text-xs text-ink-400 tabular">{category.productCount}</span>
                    </Link>
                  ))}
                </div>
                <Link
                  href={localePath('/categories')}
                  className="mt-2 block rounded-lg bg-ink-50 py-2 text-center text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  {d.common.viewAll} →
                </Link>
              </div>
            ) : null}
          </div>

          {navLinks.slice(1).map((link) => {
            const href = localePath(link.href)
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={link.href}
                href={href}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active ? 'bg-ink-100 text-ink-900' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                {link.label}
              </Link>
            )
          })}

          <Link
            href={localePath('/products?discount=1')}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-red-50"
          >
            {d.home.discountTitle}
            <Badge tone="danger">%</Badge>
          </Link>
        </nav>
      </div>

      {mobileOpen ? (
        <MobileMenu
          categories={categories}
          user={user}
          phone={phone}
          onClose={() => setMobileOpen(false)}
          navLinks={navLinks}
        />
      ) : null}
    </header>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z" fill="currentColor" />
      </svg>
    </span>
  )
}

function UserMenu({
  user,
  open,
  setOpen,
}: {
  user: HeaderUser
  open: boolean
  setOpen: (value: boolean) => void
}) {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const ref = React.useRef<HTMLDivElement>(null)
  const [loggingOut, setLoggingOut] = React.useState(false)

  React.useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [setOpen])

  async function logout() {
    setLoggingOut(true)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = localePath('/')
    }
  }

  const links = [
    { href: '/account', label: d.account.profile, icon: User },
    { href: '/account/orders', label: d.account.orders, icon: Package },
    { href: '/account/prescriptions', label: d.account.prescriptions, icon: FileText },
    { href: '/account/consultations', label: d.consultation.history.title, icon: Stethoscope },
    { href: '/account/wishlist', label: d.account.wishlist, icon: Heart },
    { href: '/account/notifications', label: d.account.notifications, icon: Bell },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:border-brand-300"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">
          {user.fullName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate lg:block">{user.fullName.split(' ')[0]}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" aria-hidden />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-pop">
          <div className="border-b border-ink-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink-900">{user.fullName}</p>
            <p className="text-xs text-ink-500">{d.account.title}</p>
          </div>

          {user.hasAdminAccess ? (
            <Link
              href="/admin"
              className="flex items-center gap-2.5 border-b border-ink-100 px-3 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              {d.nav.admin}
            </Link>
          ) : null}

          {links.map((link) => (
            <Link
              key={link.href}
              href={localePath(link.href)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-50"
            >
              <link.icon className="h-4 w-4 text-ink-400" aria-hidden />
              {link.label}
            </Link>
          ))}

          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2.5 border-t border-ink-100 px-3 py-2.5 text-sm text-danger transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {d.nav.logout}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function MobileMenu({
  categories,
  user,
  phone,
  onClose,
  navLinks,
}: {
  categories: CategoryNode[]
  user: HeaderUser | null
  phone: string
  onClose: () => void
  navLinks: { href: string; label: string }[]
}) {
  const { d } = useI18n()
  const localePath = useLocalePath()

  React.useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-ink-900/45" onClick={onClose} aria-hidden />
      <aside className="relative z-10 flex h-full w-[86%] max-w-sm animate-slide-in-left flex-col bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span>
              <span className="block text-base font-extrabold leading-none text-brand-700">
                {d.meta.siteName}
              </span>
              <span className="block text-[10px] uppercase tracking-wider text-ink-500">
                {d.meta.siteTagline}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
            aria-label={d.common.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {user ? (
            <div className="border-b border-ink-100 bg-brand-50/50 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">{user.fullName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={localePath('/account')} onClick={onClose}>
                  <Button variant="outline" size="sm">
                    {d.account.title}
                  </Button>
                </Link>
                <Link href={localePath('/account/orders')} onClick={onClose}>
                  <Button variant="outline" size="sm">
                    {d.account.orders}
                  </Button>
                </Link>
                {user.hasAdminAccess ? (
                  <Link href="/admin" onClick={onClose}>
                    <Button variant="secondary" size="sm">
                      {d.nav.admin}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex gap-2 border-b border-ink-100 px-4 py-3">
              <Link href={localePath('/login')} onClick={onClose} className="flex-1">
                <Button variant="outline" size="sm" fullWidth>
                  {d.nav.login}
                </Button>
              </Link>
              <Link href={localePath('/register')} onClick={onClose} className="flex-1">
                <Button size="sm" fullWidth>
                  {d.nav.register}
                </Button>
              </Link>
            </div>
          )}

          <nav className="px-2 py-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={localePath(link.href)}
                onClick={onClose}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-800 transition-colors hover:bg-ink-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-ink-100 px-2 py-2">
            <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              {d.nav.categories}
            </p>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={localePath(`/categories/${category.slug}`)}
                onClick={onClose}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-ink-50"
              >
                <span className="truncate">{category.name}</span>
                <span className="text-xs text-ink-400 tabular">{category.productCount}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="border-t border-ink-100 p-4">
          <div className="mb-3">
            <LanguageSwitcher />
          </div>
          <a
            href={`tel:${phone.replace(/\s/g, '')}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-50 py-2.5 text-sm font-semibold text-brand-700"
          >
            <Phone className="h-4 w-4" aria-hidden />
            {phone}
          </a>
        </div>
      </aside>
    </div>
  )
}
