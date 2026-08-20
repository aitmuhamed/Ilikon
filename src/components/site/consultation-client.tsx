'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  Info,
  Loader2,
  Package,
  Phone,
  Plus,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  X,
} from 'lucide-react'

import { useCartCount, useI18n, useLocalePath } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import { ApiClientError, apiFetch } from '@/lib/client-api'
import { cn, formatMnt } from '@/lib/utils'
import { interpolate } from '@/i18n'
import type {
  ConsultationStepKey,
  TriageLevelKey,
  WireQuestion,
  WireRecommendation,
  WireResult,
  WireState,
} from '@/lib/consultation/types'
import { STEP_ORDER } from '@/lib/consultation/types'

/**
 * The consultation wizard.
 *
 * The client is intentionally dumb. It renders whatever question the server
 * hands it and posts the answer back; it holds no question catalogue, no
 * red-flag list, no triage logic and no product filter. Every safety decision
 * lives on the server, so tampering with this component cannot change what the
 * customer is allowed to be shown.
 */

interface MedicationDraft {
  name: string
  dose: string
  frequency: string
  productId?: string | null
  barcode?: string | null
  photoKey?: string | null
  source: 'CATALOGUE_SEARCH' | 'MANUAL' | 'BARCODE' | 'PHOTO'
}

interface AllergyDraft {
  medication: string
  reaction: string
}

/** Badge tone per triage level. `BadgeTone` is internal to the design system,
 * so the literal union is spelled out here. */
const TRIAGE_TONE: Record<TriageLevelKey, 'danger' | 'warning' | 'brand' | 'success'> = {
  EMERGENCY: 'danger',
  URGENT_MEDICAL_REVIEW: 'warning',
  PHARMACIST_CONSULTATION: 'brand',
  SELF_CARE: 'success',
}

export function ConsultationClient({
  enabled,
  disclaimer,
  emergencyNumber,
  pharmacyPhone,
}: {
  enabled: boolean
  disclaimer: string
  emergencyNumber: string
  pharmacyPhone: string
}) {
  const { d, locale } = useI18n()
  const localePath = useLocalePath()
  const toast = useToast()
  const cart = useCartCount()
  const c = d.consultation

  const [state, setState] = React.useState<WireState | null>(null)
  const [starting, setStarting] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [accepted, setAccepted] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const question = state?.question ?? null
  const result = state?.result ?? null

  // ── flow actions ───────────────────────────────────────────────────────

  async function start() {
    setStarting(true)
    setError(null)
    try {
      const data = await apiFetch<{ state: WireState }>('/api/consultations', {
        method: 'POST',
        body: { locale },
      })
      setState(data.state)
    } catch (caught) {
      setError(
        caught instanceof ApiClientError && caught.code === 'CONSULTATION_DISABLED'
          ? c.errors.disabled
          : c.errors.generic,
      )
    } finally {
      setStarting(false)
    }
  }

  async function acceptDisclaimer() {
    if (!state) return
    setBusy(true)
    setError(null)
    try {
      const data = await apiFetch<{ state: WireState }>(
        `/api/consultations/${state.consultationId}/consent`,
        { method: 'POST', body: { accepted: true } },
      )
      setState(data.state)
    } catch {
      setError(c.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  async function submitAnswer(value: unknown) {
    if (!state || !question) return
    setBusy(true)
    setError(null)
    try {
      const data = await apiFetch<{ state: WireState }>(
        `/api/consultations/${state.consultationId}/answer`,
        { method: 'POST', body: { questionKey: question.key, value } },
      )
      setState(data.state)
    } catch (caught) {
      setError(
        caught instanceof ApiClientError && caught.code === 'CONSULTATION_REVIEWED'
          ? c.errors.reviewed
          : c.errors.generic,
      )
    } finally {
      setBusy(false)
    }
  }

  async function retryAssessment() {
    if (!state) return
    setBusy(true)
    try {
      const data = await apiFetch<{ state: WireState }>(
        `/api/consultations/${state.consultationId}/assess`,
        { method: 'POST', body: {} },
      )
      setState(data.state)
    } catch {
      setError(c.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  // ── screens ────────────────────────────────────────────────────────────

  if (!enabled) {
    return (
      <Card>
        <Alert tone="info" title={c.errors.disabled}>
          <a className="font-semibold underline" href={`tel:${pharmacyPhone}`}>
            {pharmacyPhone}
          </a>
        </Alert>
      </Card>
    )
  }

  if (!state) {
    return (
      <IntroScreen
        c={c}
        commonD={d}
        disclaimer={disclaimer}
        starting={starting}
        error={error}
        onStart={start}
      />
    )
  }

  if (!state.consentAccepted) {
    return (
      <Card>
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold text-ink-900">{c.disclaimerTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">{disclaimer}</p>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-ink-700">{c.disclaimerCheckbox}</span>
        </label>

        <p className="mt-3 flex items-start gap-2 text-xs text-ink-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {c.privacyNote}
        </p>

        {error && (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        )}

        <div className="mt-5">
          <Button onClick={acceptDisclaimer} disabled={!accepted || busy} loading={busy} size="lg">
            {c.disclaimerAccept}
          </Button>
        </div>
      </Card>
    )
  }

  if (result) {
    return (
      <ResultScreen
        result={result}
        consultationId={state.consultationId}
        emergencyNumber={emergencyNumber}
        pharmacyPhone={pharmacyPhone}
        onStateChange={setState}
        onRestart={() => {
          setState(null)
          setAccepted(false)
        }}
      />
    )
  }

  if (!question) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
          <p className="text-sm text-ink-600">{c.assessing}</p>
          <Button variant="ghost" size="sm" onClick={retryAssessment} loading={busy}>
            <RefreshCw className="h-4 w-4" /> {d.common.update}
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <StepIndicator step={state.step} progress={question.progress} c={c} />
      <QuestionCard
        key={question.key}
        question={question}
        consultationId={state.consultationId}
        busy={busy}
        error={error}
        onSubmit={submitAnswer}
      />
    </div>
  )
}

// ────────────────────────────── intro screen ───────────────────────────────

function IntroScreen({
  c,
  commonD,
  disclaimer,
  starting,
  error,
  onStart,
}: {
  c: ReturnType<typeof useI18n>['d']['consultation']
  commonD: ReturnType<typeof useI18n>['d']
  disclaimer: string
  starting: boolean
  error: string | null
  onStart: () => void
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-gradient-to-br from-brand-600 to-brand-700 px-5 py-7 text-white sm:px-8 sm:py-9">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" /> AI Health Assistant
        </span>
        <h1 className="mt-3 text-xl font-bold sm:text-2xl">{c.title}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">{c.greeting}</p>
      </div>

      <div className="px-5 py-5 sm:px-8 sm:py-6">
        <Alert tone="warning" title={c.disclaimerTitle}>
          {disclaimer}
        </Alert>

        <ul className="mt-4 space-y-2 text-sm text-ink-600">
          {[c.heroNote, c.privacyNote].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              {line}
            </li>
          ))}
        </ul>

        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={onStart} loading={starting} size="lg">
            <Stethoscope className="h-4 w-4" /> {c.start}
          </Button>
          <span className="text-xs text-ink-500">{commonD.consultation.heroNote}</span>
        </div>
      </div>
    </Card>
  )
}

// ───────────────────────────── step indicator ──────────────────────────────

function StepIndicator({
  step,
  progress,
  c,
}: {
  step: ConsultationStepKey
  progress: number
  c: ReturnType<typeof useI18n>['d']['consultation']
}) {
  const steps = STEP_ORDER.filter((key) => key !== 'CONSENT' && key !== 'RESULT')
  const currentIndex = Math.max(0, steps.indexOf(step as (typeof steps)[number]))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-ink-700">{c.steps[step]}</span>
        <span className="text-ink-500">
          {interpolate(c.stepOf, { current: currentIndex + 1, total: steps.length })}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-ink-200"
        role="progressbar"
        aria-label={c.progressLabel}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-300"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>
    </div>
  )
}

// ───────────────────────────── question renderer ───────────────────────────

function QuestionCard({
  question,
  consultationId,
  busy,
  error,
  onSubmit,
}: {
  question: WireQuestion
  consultationId: string
  busy: boolean
  error: string | null
  onSubmit: (value: unknown) => void
}) {
  const { d } = useI18n()
  const c = d.consultation

  const [multi, setMulti] = React.useState<string[]>([])
  const [text, setText] = React.useState('')
  const [scale, setScale] = React.useState<number | null>(null)
  const [number, setNumber] = React.useState('')
  const [allergies, setAllergies] = React.useState<AllergyDraft[]>([])
  const [medications, setMedications] = React.useState<MedicationDraft[]>([])

  const canSubmit = (() => {
    switch (question.type) {
      case 'multi':
        return true
      case 'scale':
        return scale !== null
      case 'text':
        return question.optional || text.trim().length > 0
      case 'number':
        return question.optional || number.trim().length > 0
      case 'allergies':
        return question.optional || allergies.length > 0
      case 'medications':
        return true
      default:
        return false
    }
  })()

  function submit() {
    switch (question.type) {
      case 'multi':
        return onSubmit(multi)
      case 'scale':
        return onSubmit(scale)
      case 'text':
        return onSubmit(text.trim())
      case 'number':
        return onSubmit(number.trim() === '' ? '' : Number(number))
      case 'allergies':
        return onSubmit(allergies.filter((entry) => entry.medication.trim()))
      case 'medications':
        return onSubmit(medications.filter((entry) => entry.name.trim()))
      default:
        return undefined
    }
  }

  return (
    <Card>
      <fieldset disabled={busy}>
        <legend className="text-base font-bold text-ink-900 sm:text-lg">
          {question.prompt}
          {question.optional && (
            <span className="ml-2 align-middle text-xs font-medium text-ink-400">
              ({c.optionalHint})
            </span>
          )}
        </legend>

        {question.help && <p className="mt-1.5 text-sm text-ink-500">{question.help}</p>}

        {question.isRedFlagProbe && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {c.privacyNote}
          </p>
        )}

        <div className="mt-4">
          {question.type === 'single' && (
            <div className="grid gap-2">
              {question.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onSubmit(option.value)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 text-left text-sm font-medium text-ink-800 transition hover:border-brand-400 hover:bg-brand-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60"
                >
                  <span>
                    {option.label}
                    {option.hint && (
                      <span className="mt-0.5 block text-xs font-normal text-ink-500">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:text-brand-600" />
                </button>
              ))}
            </div>
          )}

          {question.type === 'multi' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {question.options.map((option) => {
                const checked = multi.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition',
                      checked
                        ? 'border-brand-500 bg-brand-50 text-ink-900'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setMulti((current) =>
                          event.target.checked
                            ? [...current, option.value]
                            : current.filter((value) => value !== option.value),
                        )
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="font-medium">{option.label}</span>
                  </label>
                )
              })}
            </div>
          )}

          {question.type === 'scale' && (
            <ScaleInput
              min={question.min ?? 0}
              max={question.max ?? 10}
              value={scale}
              onChange={setScale}
              lowLabel={c.scaleNone}
              highLabel={c.scaleWorst}
            />
          )}

          {question.type === 'text' && (
            <Textarea
              rows={4}
              maxLength={question.max ?? 600}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={question.prompt}
            />
          )}

          {question.type === 'number' && (
            <Input
              type="number"
              inputMode="decimal"
              min={question.min ?? undefined}
              max={question.max ?? undefined}
              step="any"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              className="max-w-40"
            />
          )}

          {question.type === 'allergies' && (
            <AllergyEditor entries={allergies} onChange={setAllergies} />
          )}

          {question.type === 'medications' && (
            <MedicationEditor
              entries={medications}
              onChange={setMedications}
              consultationId={consultationId}
            />
          )}
        </div>

        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}

        {question.type !== 'single' && (
          <div className="mt-5 flex items-center gap-3">
            <Button onClick={submit} disabled={!canSubmit || busy} loading={busy}>
              {c.continueLabel}
            </Button>
            {question.optional && question.type !== 'multi' && (
              <Button variant="ghost" onClick={() => onSubmit(defaultEmpty(question))} disabled={busy}>
                {c.skip}
              </Button>
            )}
            {question.type === 'multi' && multi.length === 0 && (
              <span className="text-xs text-ink-500">{c.selectNone}</span>
            )}
          </div>
        )}
      </fieldset>
    </Card>
  )
}

function defaultEmpty(question: WireQuestion): unknown {
  switch (question.type) {
    case 'multi':
    case 'allergies':
    case 'medications':
      return []
    case 'number':
    case 'text':
      return ''
    default:
      return null
  }
}

function ScaleInput({
  min,
  max,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  min: number
  max: number
  value: number | null
  onChange: (value: number) => void
  lowLabel: string
  highLabel: string
}) {
  const steps = Array.from({ length: max - min + 1 }, (_, index) => min + index)
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            onClick={() => onChange(step)}
            aria-pressed={value === step}
            className={cn(
              'h-11 w-11 rounded-lg border text-sm font-semibold transition',
              value === step
                ? 'border-brand-600 bg-brand-600 text-white'
                : step >= 8
                  ? 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400'
                  : step >= 5
                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-brand-400',
            )}
          >
            {step}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-500">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  )
}

// ───────────────────────────── allergy editor ──────────────────────────────

function AllergyEditor({
  entries,
  onChange,
}: {
  entries: AllergyDraft[]
  onChange: (entries: AllergyDraft[]) => void
}) {
  const { d } = useI18n()
  const a = d.consultation.allergy
  const [medication, setMedication] = React.useState('')
  const [reaction, setReaction] = React.useState('')

  function add() {
    if (!medication.trim()) return
    onChange([...entries, { medication: medication.trim(), reaction: reaction.trim() }])
    setMedication('')
    setReaction('')
  }

  return (
    <div className="space-y-3">
      {entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li
              key={`${entry.medication}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2 text-sm"
            >
              <span className="text-ink-800">
                <strong className="font-semibold">{entry.medication}</strong>
                {entry.reaction && <span className="text-ink-600"> — {entry.reaction}</span>}
              </span>
              <button
                type="button"
                onClick={() => onChange(entries.filter((_, i) => i !== index))}
                className="text-ink-400 transition hover:text-rose-600"
                aria-label={a.remove}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">{a.empty}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={medication}
          onChange={(event) => setMedication(event.target.value)}
          placeholder={a.medication}
        />
        <Input
          value={reaction}
          onChange={(event) => setReaction(event.target.value)}
          placeholder={a.reaction}
        />
        <Button type="button" variant="secondary" onClick={add} disabled={!medication.trim()}>
          <Plus className="h-4 w-4" /> {a.add}
        </Button>
      </div>
      <p className="text-xs text-ink-400">{a.example}</p>
    </div>
  )
}

// ──────────────────────────── medication editor ────────────────────────────

interface MedicineHit {
  id: string
  name: string
  strength: string | null
  packageSize: string | null
}

function MedicationEditor({
  entries,
  onChange,
  consultationId,
}: {
  entries: MedicationDraft[]
  onChange: (entries: MedicationDraft[]) => void
  consultationId: string
}) {
  const { d, locale } = useI18n()
  const m = d.consultation.meds
  const toast = useToast()

  const [term, setTerm] = React.useState('')
  const [hits, setHits] = React.useState<MedicineHit[]>([])
  const [searching, setSearching] = React.useState(false)
  const [name, setName] = React.useState('')
  const [dose, setDose] = React.useState('')
  const [frequency, setFrequency] = React.useState('')
  const [productId, setProductId] = React.useState<string | null>(null)
  const [barcode, setBarcode] = React.useState('')
  const [photoKey, setPhotoKey] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [source, setSource] = React.useState<MedicationDraft['source']>('MANUAL')

  // Type-ahead against the pharmacy catalogue.
  React.useEffect(() => {
    const trimmed = term.trim()
    if (trimmed.length < 2) {
      setHits([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await apiFetch<{ items: MedicineHit[] }>(
          `/api/consultations/medicines?q=${encodeURIComponent(trimmed)}&locale=${locale}`,
          { signal: controller.signal },
        )
        setHits(data.items)
      } catch {
        setHits([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [term, locale])

  function reset() {
    setName('')
    setDose('')
    setFrequency('')
    setProductId(null)
    setBarcode('')
    setPhotoKey(null)
    setTerm('')
    setHits([])
    setSource('MANUAL')
  }

  function add() {
    if (!name.trim()) return
    onChange([
      ...entries,
      {
        name: name.trim(),
        dose: dose.trim(),
        frequency: frequency.trim(),
        productId,
        barcode: barcode.trim() || null,
        photoKey,
        source,
      },
    ])
    reset()
  }

  async function lookupBarcode() {
    if (!barcode.trim()) return
    try {
      const data = await apiFetch<{ items: MedicineHit[] }>(
        `/api/consultations/medicines?barcode=${encodeURIComponent(barcode.trim())}&locale=${locale}`,
      )
      const hit = data.items[0]
      if (!hit) {
        toast.warning(m.barcodeNotFound)
        return
      }
      setName(hit.name)
      setProductId(hit.id)
      setSource('BARCODE')
    } catch {
      toast.error(d.consultation.errors.generic)
    }
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const data = await apiFetch<{ fileKey: string }>(
        `/api/consultations/${consultationId}/medication-photo`,
        { method: 'POST', formData: form },
      )
      setPhotoKey(data.fileKey)
      setSource('PHOTO')
      toast.success(m.photoAttached)
    } catch {
      toast.error(d.consultation.errors.generic)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {entries.length > 0 ? (
        <ul className="space-y-2">
          {entries.map((entry, index) => (
            <li
              key={`${entry.name}-${index}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2 text-sm"
            >
              <span className="text-ink-800">
                <strong className="font-semibold">{entry.name}</strong>
                {(entry.dose || entry.frequency) && (
                  <span className="text-ink-600">
                    {' '}
                    — {[entry.dose, entry.frequency].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  {entry.photoKey && (
                    <Badge tone="neutral">
                      {m.photoAttached}
                    </Badge>
                  )}
                  {!entry.productId && (
                    <Badge tone="warning">
                      {m.notInCatalogue}
                    </Badge>
                  )}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(entries.filter((_, i) => i !== index))}
                className="text-ink-400 transition hover:text-rose-600"
                aria-label={m.remove}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">{m.empty}</p>
      )}

      <div className="rounded-xl border border-dashed border-ink-300 p-3.5">
        <p className="mb-2.5 text-sm font-semibold text-ink-800">{m.addTitle}</p>

        {/* catalogue search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={m.searchPlaceholder}
            className="pl-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />
          )}
          {hits.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-ink-200 bg-white shadow-lg">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50"
                    onClick={() => {
                      setName(hit.name)
                      setProductId(hit.id)
                      setSource('CATALOGUE_SEARCH')
                      setTerm('')
                      setHits([])
                    }}
                  >
                    <Package className="h-4 w-4 shrink-0 text-ink-400" />
                    <span>
                      {hit.name}
                      {hit.strength && <span className="text-ink-500"> · {hit.strength}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-1.5 text-xs text-ink-400">{m.searchHint}</p>

        {/* manual entry */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Label htmlFor="med-name">{m.manualName}</Label>
            <Input
              id="med-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setProductId(null)
                if (source === 'CATALOGUE_SEARCH') setSource('MANUAL')
              }}
            />
          </div>
          <Input value={dose} onChange={(event) => setDose(event.target.value)} placeholder={m.dose} />
          <Input
            value={frequency}
            onChange={(event) => setFrequency(event.target.value)}
            placeholder={m.frequency}
          />
          <Button type="button" variant="secondary" onClick={add} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> {m.add}
          </Button>
        </div>

        {/* barcode + photo */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder={m.barcodePlaceholder}
                className="pl-9"
                inputMode="numeric"
              />
            </div>
            <Button type="button" variant="ghost" onClick={lookupBarcode} disabled={!barcode.trim()}>
              {m.barcodeFind}
            </Button>
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-600 transition hover:border-brand-400 hover:text-brand-700">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : photoKey ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {uploading ? m.photoUploading : photoKey ? m.photoAttached : m.photo}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadPhoto(file)
              }}
            />
          </label>
        </div>
        <p className="mt-1.5 text-xs text-ink-400">{m.photoHint}</p>
      </div>
    </div>
  )
}

// ────────────────────────────── result screen ──────────────────────────────

function ResultScreen({
  result,
  consultationId,
  emergencyNumber,
  pharmacyPhone,
  onStateChange,
  onRestart,
}: {
  result: WireResult
  consultationId: string
  emergencyNumber: string
  pharmacyPhone: string
  onStateChange: (state: WireState) => void
  onRestart: () => void
}) {
  const { d } = useI18n()
  const c = d.consultation
  const r = c.result
  const toast = useToast()
  const cart = useCartCount()
  const localePath = useLocalePath()

  const [note, setNote] = React.useState('')
  const [sending, setSending] = React.useState(false)

  async function handoff() {
    setSending(true)
    try {
      const data = await apiFetch<{ state: WireState; message: string }>(
        `/api/consultations/${consultationId}/handoff`,
        { method: 'POST', body: { note } },
      )
      toast.success(data.message)
      onStateChange(data.state)
    } catch {
      toast.error(c.errors.generic)
    } finally {
      setSending(false)
    }
  }

  // ── emergency: short, direct, and nothing below it (§27) ───────────────
  if (result.emergency) {
    return (
      <Card className="border-rose-300 bg-rose-50/70">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-rose-900">{r.emergencyTitle}</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-rose-900">
              {result.safetyAssessment}
            </p>
            {result.nextStep && (
              <p className="mt-2 text-sm leading-relaxed text-rose-800">{result.nextStep}</p>
            )}

            {result.redFlags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {result.redFlags.map((flag) => (
                  <li key={flag.code}>
                    <Badge tone="danger">
                      {flag.label}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            <a
              href={`tel:${emergencyNumber}`}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-rose-700"
            >
              <Phone className="h-5 w-5" />
              {interpolate(r.emergencyCall, { number: emergencyNumber })}
            </a>

            <p className="mt-4 text-xs text-rose-800/80">
              {r.code}: {result.code}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const showable = result.recommendations

  return (
    <div className="space-y-4">
      {/* 1–2. understanding + safety assessment */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-ink-900">{r.title}</h2>
          <Badge tone={TRIAGE_TONE[result.triageLevel]}>{c.triage[result.triageLevel]}</Badge>
        </div>

        <Section title={r.understood}>{result.understood}</Section>
        {result.symptomSummary && (
          <p className="mt-1 text-sm text-ink-500">
            {r.symptoms}: {result.symptomSummary}
          </p>
        )}
        <Section title={r.safety}>{result.safetyAssessment}</Section>

        {result.redFlags.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              {r.redFlags}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {result.redFlags.map((flag) => (
                <li key={flag.code}>
                  <Badge tone={flag.severity === 'EMERGENCY' ? 'danger' : 'warning'}>
                    {flag.label}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* 3. next step */}
      <Card>
        <Section title={r.nextStep}>{result.nextStep}</Section>
        {result.pharmacistNote && (
          <Alert tone="info" title={r.pharmacistNote} className="mt-3">
            {result.pharmacistNote}
          </Alert>
        )}
      </Card>

      {/* 4. products */}
      {showable.length > 0 ? (
        <div>
          <h3 className="mb-2.5 text-sm font-bold uppercase tracking-wide text-ink-600">
            {r.products}
          </h3>
          <div className="grid gap-3">
            {showable.map((item) => (
              <RecommendationCard
                key={item.id}
                item={item}
                onAdded={() => cart.refresh()}
              />
            ))}
          </div>
          {result.duplicateIngredientWarning && (
            <Alert tone="warning" title={r.duplicateWarning} className="mt-3">
              {result.duplicateIngredientWarning}
            </Alert>
          )}
        </div>
      ) : (
        <Card>
          <p className="text-sm text-ink-600">{r.noProducts}</p>
        </Card>
      )}

      {/* 5–6. precautions and when to seek care */}
      {result.precautions && (
        <Card>
          <Section title={r.precautions}>{result.precautions}</Section>
        </Card>
      )}
      <Card className="border-amber-200 bg-amber-50/60">
        <Section title={r.seekCare}>{result.seekCare}</Section>
      </Card>

      {/* 7. pharmacist option */}
      <Card>
        <h3 className="text-sm font-bold text-ink-900">{r.pharmacistOption}</h3>
        {result.handedOff ? (
          <Alert tone="success" className="mt-2">
            {r.handoffDone}
          </Alert>
        ) : (
          <>
            <Textarea
              rows={2}
              className="mt-2"
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={r.handoffNote}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handoff} loading={sending}>
                <Stethoscope className="h-4 w-4" /> {r.askPharmacist}
              </Button>
              <a
                href={`tel:${pharmacyPhone}`}
                className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-brand-400"
              >
                <Phone className="h-4 w-4" /> {pharmacyPhone}
              </a>
            </div>
          </>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-50 px-4 py-3 text-xs text-ink-500">
        <span>
          {r.code}: <strong className="font-semibold text-ink-700">{result.code}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          {result.disclaimer}
        </span>
        <button type="button" onClick={onRestart} className="font-semibold text-brand-700 underline">
          {r.restart}
        </button>
      </div>
    </div>
  )
}

/**
 * A stored consultation rendered on its own — used by the account history so a
 * customer sees exactly the summary they saw at the time, including whatever a
 * pharmacist added afterwards. The pharmacist handoff stays available, because
 * wanting to talk to a human later is a normal outcome.
 */
export function ConsultationResultPanel({
  result,
  emergencyNumber,
  pharmacyPhone,
  newConsultationHref,
}: {
  result: WireResult
  emergencyNumber: string
  pharmacyPhone: string
  newConsultationHref: string
}) {
  const [current, setCurrent] = React.useState(result)

  return (
    <ResultScreen
      result={current}
      consultationId={result.consultationId}
      emergencyNumber={emergencyNumber}
      pharmacyPhone={pharmacyPhone}
      onStateChange={(state) => {
        if (state.result) setCurrent(state.result)
      }}
      onRestart={() => {
        window.location.href = newConsultationHref
      }}
    />
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div className="mt-4 first:mt-0">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
      <p className="text-sm leading-relaxed text-ink-800">{children}</p>
    </div>
  )
}

function RecommendationCard({
  item,
  onAdded,
}: {
  item: WireRecommendation
  onAdded: () => void
}) {
  const { d, locale } = useI18n()
  const r = d.consultation.result
  const localePath = useLocalePath()
  const toast = useToast()
  const [adding, setAdding] = React.useState(false)

  async function addToCart() {
    if (!item.productId) return
    setAdding(true)
    try {
      await apiFetch(`/api/cart/items?locale=${locale}`, {
        method: 'POST',
        body: { productId: item.productId, quantity: 1 },
      })
      toast.success(r.addToCart)
      onAdded()
    } catch {
      toast.error(d.consultation.errors.generic)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Card className="p-0">
      <div className="flex gap-3 p-3.5 sm:gap-4 sm:p-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-ink-200 bg-white sm:h-24 sm:w-24">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain" />
          ) : (
            <Package className="h-7 w-7 text-ink-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-sm font-bold text-ink-900">{item.name}</h4>
              <p className="mt-0.5 text-xs text-ink-500">
                {[item.activeIngredients, item.strength, item.packageSize]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {item.price !== null && (
              <span className="shrink-0 text-sm font-bold text-brand-700">
                {formatMnt(item.price, locale)}
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.addedByPharmacist && (
              <Badge tone="brand" icon={<Stethoscope className="h-3 w-3" />}>
                {d.admin.pharmacistColumn}
              </Badge>
            )}
            <Badge
              tone={item.status === 'SAFE_TO_SHOW' ? 'success' : 'warning'}
             
              icon={
                item.status === 'SAFE_TO_SHOW' ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )
              }
            >
              {item.status === 'SAFE_TO_SHOW' ? r.safeBadge : r.pharmacistReviewBadge}
            </Badge>
            {!item.inStock && (
              <Badge tone="neutral">
                {d.product.outOfStock}
              </Badge>
            )}
          </div>

          {item.reason && (
            <p className="mt-2.5 text-xs leading-relaxed text-ink-600">
              <strong className="font-semibold text-ink-700">{r.whyRelevant}:</strong> {item.reason}
            </p>
          )}
          {item.safetyNotes && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                <strong className="font-semibold">{r.important}:</strong> {item.safetyNotes}
              </span>
            </p>
          )}
          {item.sourceLabel && (
            <p className="mt-1.5 text-[11px] text-ink-400">
              {r.source}: {item.sourceLabel}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
             
              onClick={addToCart}
              loading={adding}
              disabled={!item.productId || !item.inStock || item.prescriptionRequired}
            >
              {r.addToCart}
            </Button>
            {item.slug && (
              <Link
                href={localePath(`/products/${item.slug}`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-brand-400"
              >
                {r.viewProduct}
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
