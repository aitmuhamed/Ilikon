/**
 * End-to-end smoke test for the AI consultation engine.
 *
 *   npx tsx --env-file=.env scripts/consultation-smoke.ts
 *
 * Drives the real questionnaire, red-flag, triage, contraindication,
 * interaction and ranking code against the seeded knowledge base — no HTTP, no
 * browser. Each scenario asserts the triage level and the product outcome, so a
 * regression in a safety rule fails here rather than in front of a customer.
 *
 * The LLM is switched off for the run: these assertions are about the
 * deterministic engines, which must hold with or without a model.
 */
import { prisma } from '../src/lib/prisma'
import { getSettings, updateSettings } from '../src/lib/settings'
import { createConsultation, acceptDisclaimer, recordAnswer, reload } from '../src/lib/consultation/session'
import { runAssessment } from '../src/lib/consultation/engine'
import { nextQuestion, toWireQuestion } from '../src/lib/consultation/questionnaire'
import { toAnswerState } from '../src/lib/consultation/session'
import type { WireResult } from '../src/lib/consultation/types'

interface Scenario {
  name: string
  locale: 'mn' | 'en' | 'ru'
  /** Answer for a question key; `undefined` means "use the default policy". */
  answers: Record<string, unknown>
  expect: {
    triage: WireResult['triageLevel']
    /** Minimum number of products the customer should see. */
    minProducts?: number
    maxProducts?: number
    /** Product names that must NOT be shown. */
    forbidden?: string[]
    /** Substring that must appear in a safety notice or precaution. */
    mustMention?: string
    redFlags?: string[]
  }
}

const SCENARIOS: Scenario[] = [
  {
    name: 'Adult tension headache, nothing else → self-care with products',
    locale: 'mn',
    answers: {
      age_band: 'AGE_18_64',
      sex: 'MALE',
      primary_symptom: 'headache',
      symptom_free_text: '',
      secondary_symptoms: [],
      onset: 'today',
      severity: 4,
      course: 'ACUTE',
      worsening: 'no',
      meds_already_taken: '',
      headache_location: 'both_sides',
      headache_onset_type: 'gradual',
      headache_had_before: 'yes',
      headache_fever: 'no',
      headache_vomiting: 'no',
      headache_vision: 'no',
      headache_weakness: 'no',
      headache_confusion: 'no',
      headache_injury: 'no',
      conditions: [],
      allergy_declared: 'no',
      current_medications: [],
      red_flag_checklist: [],
    },
    expect: { triage: 'SELF_CARE', minProducts: 1 },
  },
  {
    name: 'Thunderclap headache → emergency, no products',
    locale: 'mn',
    answers: {
      age_band: 'AGE_18_64',
      sex: 'MALE',
      primary_symptom: 'headache',
      onset: 'under_6h',
      severity: 9,
      course: 'ACUTE',
      worsening: 'yes',
      headache_location: 'whole_head',
      headache_onset_type: 'thunderclap',
    },
    expect: { triage: 'EMERGENCY', maxProducts: 0, redFlags: ['sudden_severe_headache'] },
  },
  {
    name: 'Free-text chest pain in the description → emergency',
    locale: 'mn',
    answers: {
      age_band: 'AGE_18_64',
      sex: 'FEMALE',
      pregnancy: 'NEITHER',
      primary_symptom: 'other',
      symptom_free_text: 'Цээж хүчтэй өвдөж, амьсгал давчдаж байна.',
    },
    expect: { triage: 'EMERGENCY', maxProducts: 0, redFlags: ['chest_pain', 'breathing_difficulty'] },
  },
  {
    name: 'Pregnant adult with headache → pharmacist, ibuprofen must be withheld',
    locale: 'mn',
    answers: {
      age_band: 'AGE_18_64',
      sex: 'FEMALE',
      pregnancy: 'PREGNANT',
      primary_symptom: 'headache',
      onset: 'days_1_3',
      severity: 5,
      course: 'ACUTE',
      worsening: 'no',
      headache_location: 'forehead',
      headache_onset_type: 'gradual',
      headache_had_before: 'yes',
      headache_fever: 'no',
      headache_vomiting: 'no',
      headache_vision: 'no',
      headache_weakness: 'no',
      headache_confusion: 'no',
      headache_injury: 'no',
      conditions: [],
      allergy_declared: 'no',
      current_medications: [],
      red_flag_checklist: [],
    },
    expect: {
      triage: 'PHARMACIST_CONSULTATION',
      forbidden: ['Ибупрофен 400 мг'],
      mustMention: 'эм зүйч',
    },
  },
  {
    name: 'Ibuprofen allergy + ulcer → NSAID blocked, paracetamol held for pharmacist',
    locale: 'mn',
    answers: {
      age_band: 'AGE_18_64',
      sex: 'MALE',
      primary_symptom: 'muscle_pain',
      onset: 'days_1_3',
      severity: 5,
      course: 'ACUTE',
      worsening: 'no',
      msk_injury: 'no',
      conditions: ['ulcer'],
      allergy_declared: 'yes',
      allergy_list: [{ medication: 'Ибупрофен', reaction: 'Тууралт' }],
      current_medications: [],
      red_flag_checklist: [],
    },
    expect: { triage: 'PHARMACIST_CONSULTATION', forbidden: ['Ибупрофен 400 мг'] },
  },
  {
    name: 'Warfarin patient asking about joint pain → NSAID blocked on interaction',
    locale: 'en',
    answers: {
      age_band: 'AGE_18_64',
      sex: 'MALE',
      primary_symptom: 'joint_pain',
      onset: 'days_1_3',
      severity: 5,
      course: 'ACUTE',
      worsening: 'no',
      msk_injury: 'no',
      msk_swelling: 'no',
      conditions: [],
      allergy_declared: 'no',
      current_medications: [{ name: 'Warfarin', dose: '5 mg', frequency: 'once daily' }],
      red_flag_checklist: [],
    },
    expect: { triage: 'PHARMACIST_CONSULTATION', forbidden: ['Ибупрофен 400 мг'] },
  },
  {
    name: 'Infant with fever → emergency (infant red flag)',
    locale: 'mn',
    answers: {
      age_band: 'UNDER_2',
      exact_age: 0,
      sex: 'FEMALE',
      primary_symptom: 'fever',
      onset: 'today',
      severity: 6,
      course: 'ACUTE',
      worsening: 'no',
    },
    expect: { triage: 'EMERGENCY', maxProducts: 0, redFlags: ['infant_severe'] },
  },
  {
    name: 'Cough running 3 weeks → urgent medical review, no self-treatment loop',
    locale: 'mn',
    answers: {
      age_band: 'AGE_18_64',
      sex: 'MALE',
      primary_symptom: 'cough',
      onset: 'weeks_1_4',
      severity: 5,
      course: 'PERSISTENT',
      worsening: 'no',
      cough_type: 'dry',
      cough_fever: 'no',
      cough_breathless: 'no',
      cough_chest_pain: 'no',
      cough_wheezing: 'no',
      cough_blood: 'no',
      cough_smoking: 'yes',
      cough_respiratory_disease: 'no',
      conditions: [],
      allergy_declared: 'no',
      current_medications: [],
      red_flag_checklist: [],
    },
    expect: { triage: 'URGENT_MEDICAL_REVIEW' },
  },
  {
    name: 'Mild allergy symptoms → self-care with antihistamine options',
    locale: 'ru',
    answers: {
      age_band: 'AGE_18_64',
      sex: 'MALE',
      primary_symptom: 'allergy',
      onset: 'days_1_3',
      severity: 3,
      course: 'ACUTE',
      worsening: 'no',
      allergy_airway: 'no',
      allergy_trigger: 'Пыль',
      conditions: [],
      allergy_declared: 'no',
      current_medications: [],
      red_flag_checklist: [],
    },
    expect: { triage: 'SELF_CARE', minProducts: 1 },
  },
  {
    name: 'Elderly patient on enalapril + metformin → pharmacist, interaction warning',
    locale: 'en',
    answers: {
      age_band: 'AGE_65_PLUS',
      exact_age: 71,
      sex: 'MALE',
      primary_symptom: 'back_pain',
      onset: 'days_1_3',
      severity: 5,
      course: 'ACUTE',
      worsening: 'no',
      msk_injury: 'no',
      back_neuro: 'no',
      conditions: ['hypertension', 'diabetes'],
      allergy_declared: 'no',
      current_medications: [
        { name: 'Enalapril', dose: '10 mg' },
        { name: 'Metformin', dose: '850 mg' },
      ],
      red_flag_checklist: [],
    },
    expect: { triage: 'PHARMACIST_CONSULTATION' },
  },
]

/**
 * Reasonable default for any question a scenario did not pin down. Numeric
 * defaults respect the question's own bounds, so an optional "measured
 * temperature (34-43)" field is not answered with a zero.
 */
function defaultAnswer(
  key: string,
  type: string,
  options: { value: string }[],
  min: number | null,
  max: number | null,
): unknown {
  switch (type) {
    case 'single': {
      const no = options.find((option) => option.value === 'no')
      return (no ?? options[options.length - 1])?.value ?? null
    }
    case 'multi':
      return []
    case 'scale':
      return Math.max(min ?? 0, Math.min(max ?? 10, 3))
    case 'number': {
      if (key === 'exact_age') return 30
      return min ?? 0
    }
    case 'text':
      return ''
    case 'allergies':
    case 'medications':
      return []
    default:
      return null
  }
}

let failures = 0

function check(scenario: string, label: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`   ✓ ${label}`)
  } else {
    failures += 1
    console.log(`   ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function run(scenario: Scenario) {
  console.log(`\n▸ ${scenario.name}`)

  const settings = await getSettings()
  let consultation = await createConsultation({ userId: null, locale: scenario.locale, settings })
  consultation = await acceptDisclaimer(consultation)

  let asked = 0
  for (;;) {
    const state = toAnswerState(consultation)
    const question = nextQuestion(state)
    if (!question) break
    if (asked > 60) throw new Error('questionnaire did not terminate')
    asked += 1

    const wire = toWireQuestion(question, state, scenario.locale)
    const value =
      scenario.answers[question.key] !== undefined
        ? scenario.answers[question.key]
        : defaultAnswer(question.key, wire.type, wire.options, wire.min, wire.max)

    const result = await recordAnswer({ consultation, questionKey: question.key, value })
    consultation = result.consultation
    if (result.complete) break
  }

  const assessment = await runAssessment({ consultation: await reload(consultation.id), settings })
  const { result } = assessment

  console.log(
    `   triage=${result.triageLevel} products=${result.recommendations.length} redFlags=${result.redFlags
      .map((f) => f.code)
      .join(',') || '-'} questions=${asked}`,
  )

  check(scenario.name, `triage is ${scenario.expect.triage}`, result.triageLevel === scenario.expect.triage, `got ${result.triageLevel}`)

  if (scenario.expect.minProducts !== undefined) {
    check(
      scenario.name,
      `at least ${scenario.expect.minProducts} product(s) shown`,
      result.recommendations.length >= scenario.expect.minProducts,
      `got ${result.recommendations.length}`,
    )
  }
  if (scenario.expect.maxProducts !== undefined) {
    check(
      scenario.name,
      `at most ${scenario.expect.maxProducts} product(s) shown`,
      result.recommendations.length <= scenario.expect.maxProducts,
      `got ${result.recommendations.length}: ${result.recommendations.map((r) => r.name).join(', ')}`,
    )
  }
  for (const forbidden of scenario.expect.forbidden ?? []) {
    check(
      scenario.name,
      `"${forbidden}" is not shown`,
      !result.recommendations.some((item) => item.name.includes(forbidden)),
      result.recommendations.map((r) => r.name).join(', '),
    )
  }
  for (const code of scenario.expect.redFlags ?? []) {
    check(
      scenario.name,
      `red flag ${code} detected`,
      result.redFlags.some((flag) => flag.code === code),
      result.redFlags.map((f) => f.code).join(',') || 'none',
    )
  }
  if (scenario.expect.mustMention) {
    const haystack = [
      result.precautions,
      result.nextStep,
      result.safetyAssessment,
      ...result.notices.map((n) => n.message),
      ...result.recommendations.map((r) => r.safetyNotes ?? ''),
    ]
      .join(' ')
      .toLowerCase()
    check(
      scenario.name,
      `mentions "${scenario.expect.mustMention}"`,
      haystack.includes(scenario.expect.mustMention.toLowerCase()),
    )
  }

  // Invariants that must hold for every single consultation.
  check(
    scenario.name,
    'no prescription-only product is ever shown',
    result.recommendations.every((item) => !item.prescriptionRequired),
  )
  if (result.emergency) {
    check(scenario.name, 'emergency response carries no products', result.recommendations.length === 0)
    check(scenario.name, 'emergency number present', result.emergencyNumber.length > 0)
  }

  // Clean up so repeated runs do not pollute the admin dashboard.
  await prisma.consultation.delete({ where: { id: consultation.id } })
}

async function main() {
  const original = await getSettings()
  // Assert the deterministic engines; the model is exercised separately.
  await updateSettings({ consultationLlmEnabled: false })

  try {
    for (const scenario of SCENARIOS) {
      await run(scenario)
    }
  } finally {
    await updateSettings({ consultationLlmEnabled: original.consultationLlmEnabled })
  }

  console.log(
    failures === 0
      ? `\n✅  All consultation scenarios passed (${SCENARIOS.length} scenarios)\n`
      : `\n❌  ${failures} assertion(s) failed\n`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
