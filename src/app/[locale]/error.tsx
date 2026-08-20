'use client'

import * as React from 'react'
import { AlertOctagon, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/providers'

/**
 * Storefront error boundary. The message is never rendered from the error
 * object — a server error string can carry internals — only a translated,
 * generic explanation plus a retry.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { d } = useI18n()

  React.useEffect(() => {
    console.error('[storefront] render error', error.digest ?? error.message)
  }, [error])

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-danger">
        <AlertOctagon className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-xl font-bold text-ink-900">{d.errors.serverError}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-500">{d.errors.generic}</p>
      {error.digest ? (
        <p className="mt-2 text-xs text-ink-400">
          {d.common.copy}: <span className="tabular">{error.digest}</span>
        </p>
      ) : null}

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw className="h-4 w-4" aria-hidden />
          {d.common.retry}
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {d.errors.backHome}
        </Button>
      </div>
    </div>
  )
}
