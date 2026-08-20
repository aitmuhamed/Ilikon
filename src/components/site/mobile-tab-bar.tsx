'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Grid3x3, Home, Search, ShoppingCart, User } from 'lucide-react'

import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { cn } from '@/lib/utils'

/**
 * Bottom navigation for phones: Home, Categories, Search, Cart, Account —
 * the five destinations that carry the whole ordering flow.
 */
export function MobileTabBar() {
  const { d } = useI18n()
  const localePath = useLocalePath()
  const pathname = usePathname()
  const cart = useCartCount()

  const tabs = [
    { href: '/', label: d.nav.home, icon: Home },
    { href: '/categories', label: d.nav.categories, icon: Grid3x3 },
    { href: '/products', label: d.common.search, icon: Search },
    { href: '/cart', label: d.nav.cart, icon: ShoppingCart, badge: cart.count },
    { href: '/account', label: d.nav.account, icon: User },
  ]

  return (
    <>
      {/* Spacer so page content is never hidden behind the bar. */}
      <div className="h-[68px] lg:hidden" aria-hidden />
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch">
          {tabs.map((tab) => {
            const href = localePath(tab.href)
            const active =
              tab.href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={tab.href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                  active ? 'text-brand-700' : 'text-ink-500',
                )}
              >
                <span className="relative">
                  <tab.icon className={cn('h-5 w-5', active && 'stroke-[2.4]')} aria-hidden />
                  {tab.badge && tab.badge > 0 ? (
                    <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-white">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{tab.label}</span>
                {active ? (
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-500" aria-hidden />
                ) : null}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
