'use client'

import * as React from 'react'
import { Lock, Save, Settings2, Stethoscope } from 'lucide-react'

import { useI18n } from '@/components/providers'
import { useToast } from '@/components/ui/toast'
import { Alert, Badge, Card } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { Input, Label, Select, Switch, Textarea } from '@/components/ui/field'
import { ApiClientError, apiFetch } from '@/lib/client-api'
import type { TriageLevelKey } from '@/lib/consultation/types'

/**
 * Admin controls for the consultation agent (§23) and the pharmacist review
 * form (§20, §21).
 *
 * The safety-critical fields are rendered read-only unless the actor holds
 * `consultations.safety`. The API enforces the same rule independently — this
 * is only so the UI does not invite an edit that would be rejected.
 */

export interface ConsultationConfig {
  consultationEnabled: boolean
  consultationLlmEnabled: boolean
  consultationMaxProducts: number
  consultationMinExpiryDays: number
  consultationRetentionDays: number
  consultationEscalationLevel: string
  consultationLocales: string[]
  consultationSystemPromptExtra: string
  consultationDisclaimerMn: string
  consultationDisclaimerEn: string
  consultationDisclaimerRu: string
  emergencyNumber: string
  emergencyNote: string
}

const ESCALATION_LEVELS: TriageLevelKey[] = [
  'EMERGENCY',
  'URGENT_MEDICAL_REVIEW',
  'PHARMACIST_CONSULTATION',
  'SELF_CARE',
]

export function ConsultationConfigCard({
  settings,
  canConfigure,
  canEditSafety,
}: {
  settings: ConsultationConfig
  canConfigure: boolean
  canEditSafety: boolean
}) {
  const { d } = useI18n()
  const toast = useToast()
  const [form, setForm] = React.useState(settings)
  const [saving, setSaving] = React.useState(false)
  const [open, setOpen] = React.useState(false)

  function set<K extends keyof ConsultationConfig>(key: K, value: ConsultationConfig[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      // Safety-critical keys are only sent when the actor may change them, so a
      // read-only field cannot be smuggled back unchanged and re-audited.
      const payload: Partial<ConsultationConfig> = {
        consultationEnabled: form.consultationEnabled,
        consultationLlmEnabled: form.consultationLlmEnabled,
        consultationMaxProducts: form.consultationMaxProducts,
        consultationRetentionDays: form.consultationRetentionDays,
        consultationLocales: form.consultationLocales,
        ...(canEditSafety
          ? {
              consultationEscalationLevel: form.consultationEscalationLevel,
              consultationMinExpiryDays: form.consultationMinExpiryDays,
              consultationSystemPromptExtra: form.consultationSystemPromptExtra,
              consultationDisclaimerMn: form.consultationDisclaimerMn,
              consultationDisclaimerEn: form.consultationDisclaimerEn,
              consultationDisclaimerRu: form.consultationDisclaimerRu,
              emergencyNumber: form.emergencyNumber,
              emergencyNote: form.emergencyNote,
            }
          : {}),
      }

      await apiFetch('/api/settings', { method: 'PATCH', body: payload })
      toast.success(d.common.save)
    } catch (error) {
      toast.error(
        error instanceof ApiClientError && error.code === 'SAFETY_PERMISSION_REQUIRED'
          ? d.admin.safetyRulesLocked
          : d.errors.generic,
      )
    } finally {
      setSaving(false)
    }
  }

  if (!canConfigure) return null

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Settings2 className="h-4 w-4 text-brand-600" />
          {d.admin.agentConfig}
        </span>
        <span className="flex items-center gap-2">
          <Badge tone={form.consultationEnabled ? 'success' : 'neutral'}>
            {form.consultationEnabled ? d.common.active : d.common.inactive}
          </Badge>
          <span className="text-xs text-ink-400">{open ? '−' : '+'}</span>
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-ink-100 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Switch
              label={d.admin.agentEnabled}
              checked={form.consultationEnabled}
              onChange={(value) => set('consultationEnabled', value)}
            />
            <Switch
              label={d.admin.llmModel}
              description={d.admin.aiDeterministic}
              checked={form.consultationLlmEnabled}
              onChange={(value) => set('consultationLlmEnabled', value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="cfg-max">{d.consultation.result.products}</Label>
              <Input
                id="cfg-max"
                type="number"
                min={1}
                max={5}
                value={form.consultationMaxProducts}
                onChange={(event) => set('consultationMaxProducts', Number(event.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="cfg-retention">{d.admin.purgedNotice.slice(0, 24)}</Label>
              <Input
                id="cfg-retention"
                type="number"
                min={1}
                max={3650}
                value={form.consultationRetentionDays}
                onChange={(event) => set('consultationRetentionDays', Number(event.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="cfg-expiry">{d.admin.expiringProducts}</Label>
              <Input
                id="cfg-expiry"
                type="number"
                min={0}
                max={365}
                value={form.consultationMinExpiryDays}
                disabled={!canEditSafety}
                onChange={(event) => set('consultationMinExpiryDays', Number(event.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cfg-escalation">{d.admin.pharmacistReferrals}</Label>
              <Select
                id="cfg-escalation"
                value={form.consultationEscalationLevel}
                disabled={!canEditSafety}
                onChange={(event) => set('consultationEscalationLevel', event.target.value)}
              >
                {ESCALATION_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {d.consultation.triage[level]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cfg-emergency">{d.consultation.result.emergencyTitle}</Label>
              <Input
                id="cfg-emergency"
                value={form.emergencyNumber}
                disabled={!canEditSafety}
                onChange={(event) => set('emergencyNumber', event.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cfg-prompt">{d.admin.agentConfig}</Label>
            <Textarea
              id="cfg-prompt"
              rows={3}
              value={form.consultationSystemPromptExtra}
              disabled={!canEditSafety}
              maxLength={2000}
              onChange={(event) => set('consultationSystemPromptExtra', event.target.value)}
            />
          </div>

          <div className="grid gap-3">
            {(['Mn', 'En', 'Ru'] as const).map((suffix) => {
              const key = `consultationDisclaimer${suffix}` as keyof ConsultationConfig
              return (
                <div key={suffix}>
                  <Label htmlFor={`cfg-disc-${suffix}`}>
                    {d.consultation.disclaimerTitle} ({suffix.toUpperCase()})
                  </Label>
                  <Textarea
                    id={`cfg-disc-${suffix}`}
                    rows={2}
                    value={String(form[key] ?? '')}
                    disabled={!canEditSafety}
                    maxLength={1000}
                    onChange={(event) => set(key, event.target.value as never)}
                  />
                </div>
              )
            })}
          </div>

          {!canEditSafety && (
            <Alert tone="warning" title={d.admin.safetyRulesLocked}>
              {d.admin.safetyRulesHint}
            </Alert>
          )}

          <Button onClick={save} loading={saving}>
            {canEditSafety ? <Save className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {d.common.save}
          </Button>
        </div>
      )}
    </Card>
  )
}

// ──────────────────────────── pharmacist review ────────────────────────────

type ReviewAction = 'ACCEPT' | 'MODIFY' | 'REJECT' | 'NOTE' | 'REQUEST_INFO' | 'RECOMMEND_PRODUCT'

export function PharmacistReviewForm({
  consultationId,
  canReview,
  currentTriage,
  recommendations,
}: {
  consultationId: string
  canReview: boolean
  currentTriage: TriageLevelKey | null
  recommendations: { id: string; name: string; status: string; addedByPharmacist: boolean }[]
}) {
  const { d } = useI18n()
  const toast = useToast()

  const [action, setAction] = React.useState<ReviewAction>('ACCEPT')
  const [recommendation, setRecommendation] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [note, setNote] = React.useState('')
  const [triageOverride, setTriageOverride] = React.useState<string>('')
  const [productId, setProductId] = React.useState('')
  const [withdraw, setWithdraw] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  const ACTION_LABELS: Record<ReviewAction, string> = {
    ACCEPT: d.admin.reviewAccept,
    MODIFY: d.admin.reviewModify,
    REJECT: d.admin.reviewReject,
    NOTE: d.admin.reviewNote,
    REQUEST_INFO: d.admin.reviewRequestInfo,
    RECOMMEND_PRODUCT: d.admin.reviewRecommendProduct,
  }

  if (!canReview) {
    return (
      <Alert tone="info" title={d.admin.pharmacistColumn}>
        {d.admin.safetyRulesHint}
      </Alert>
    )
  }

  async function submit() {
    setSaving(true)
    try {
      await apiFetch(`/api/consultations/${consultationId}/review`, {
        method: 'POST',
        body: {
          action,
          pharmacistRecommendation: recommendation || undefined,
          reasonForChange: reason || undefined,
          note: note || undefined,
          triageOverride: triageOverride || undefined,
          productId: action === 'RECOMMEND_PRODUCT' ? productId || undefined : undefined,
          removeRecommendationIds: withdraw.length > 0 ? withdraw : undefined,
        },
      })
      toast.success(d.admin.submitReview)
      window.location.reload()
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : d.errors.generic,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Stethoscope className="h-4 w-4 text-brand-600" />
        {d.admin.reviewAction}
      </h2>

      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(ACTION_LABELS) as ReviewAction[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setAction(key)}
            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              action === key
                ? 'border-brand-500 bg-brand-50 text-brand-800'
                : 'border-ink-200 text-ink-600 hover:border-brand-300'
            }`}
          >
            {ACTION_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {(action === 'MODIFY' || action === 'RECOMMEND_PRODUCT' || action === 'REQUEST_INFO') && (
          <div>
            <Label htmlFor="rev-recommendation">{d.admin.pharmacistRecommendation}</Label>
            <Textarea
              id="rev-recommendation"
              rows={3}
              maxLength={2000}
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value)}
            />
          </div>
        )}

        {(action === 'MODIFY' || action === 'REJECT') && (
          <div>
            <Label htmlFor="rev-reason">{d.admin.reasonForChange}</Label>
            <Input
              id="rev-reason"
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        )}

        {action === 'RECOMMEND_PRODUCT' && (
          <div>
            <Label htmlFor="rev-product">{d.admin.addProduct}</Label>
            <Input
              id="rev-product"
              value={productId}
              placeholder="product id"
              onChange={(event) => setProductId(event.target.value)}
            />
          </div>
        )}

        <div>
          <Label htmlFor="rev-note">{d.admin.reviewNote}</Label>
          <Textarea
            id="rev-note"
            rows={2}
            maxLength={2000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="rev-triage">{d.admin.triageOverride}</Label>
          <Select
            id="rev-triage"
            value={triageOverride}
            onChange={(event) => setTriageOverride(event.target.value)}
          >
            <option value="">
              {currentTriage ? d.consultation.triage[currentTriage] : d.common.none}
            </option>
            {ESCALATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {d.consultation.triage[level]}
              </option>
            ))}
          </Select>
        </div>

        {recommendations.filter((item) => item.status !== 'BLOCKED').length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink-700">{d.admin.withdrawProduct}</p>
            <div className="space-y-1.5">
              {recommendations
                .filter((item) => item.status !== 'BLOCKED')
                .map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-ink-700">
                    <input
                      type="checkbox"
                      checked={withdraw.includes(item.id)}
                      onChange={(event) =>
                        setWithdraw((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                      className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    />
                    {item.name}
                    {item.addedByPharmacist && (
                      <Badge tone="brand">{d.admin.pharmacistColumn}</Badge>
                    )}
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>

      <Button className="mt-4" onClick={submit} loading={saving}>
        {d.admin.submitReview}
      </Button>
    </Card>
  )
}
