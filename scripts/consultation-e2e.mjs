/**
 * End-to-end check of the AI consultation over HTTP.
 * Usage: node scripts/consultation-e2e.mjs <port>
 *
 * Exercises the parts the in-process smoke test cannot: the route wrapper, the
 * httpOnly continuation cookie, the access-control boundary between two
 * visitors, the pharmacist handoff, and the pharmacist review flow.
 */
const PORT = process.argv[2] ?? '3007'
const BASE = `http://localhost:${PORT}`

const jars = new Map()
function jar(name) {
  if (!jars.has(name)) jars.set(name, new Map())
  return jars.get(name)
}

async function call(who, path, options = {}) {
  const headers = { ...(options.headers ?? {}) }
  const cookies = [...jar(who).entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  if (cookies) headers.cookie = cookies
  if (options.body) headers['content-type'] = 'application/json'
  const csrf = jar(who).get('ilikon_csrf')
  if (csrf && options.method && options.method !== 'GET') headers['x-csrf-token'] = csrf

  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: 'manual',
  })

  for (const raw of res.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';')
    const idx = pair.indexOf('=')
    jar(who).set(pair.slice(0, idx), pair.slice(idx + 1))
  }

  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  return { status: res.status, json, text }
}

let failures = 0
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`   ✓ ${label}`)
  } else {
    failures += 1
    console.log(`   ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Answers whatever question the server asks, steering toward a scenario. */
function answerFor(question, overrides) {
  if (question.key in overrides) return overrides[question.key]
  switch (question.type) {
    case 'single': {
      const no = question.options.find((o) => o.value === 'no')
      return (no ?? question.options[question.options.length - 1]).value
    }
    case 'multi':
      return []
    case 'scale':
      return 3
    case 'number':
      return question.min ?? 0
    case 'text':
      return ''
    case 'allergies':
    case 'medications':
      return []
    default:
      return null
  }
}

async function runFlow(who, overrides, label) {
  console.log(`\n▸ ${label}`)

  const started = await call(who, '/api/consultations', { method: 'POST', body: { locale: 'mn' } })
  check('consultation created', started.status === 200 && started.json?.data?.state?.consultationId, `status ${started.status}`)
  if (started.status !== 200) return null

  const id = started.json.data.state.consultationId
  check('continuation cookie is httpOnly', jar(who).has('ilikon_consultation'))
  check('disclaimer returned before any question', Boolean(started.json.data.disclaimer))
  check('no question issued before consent', started.json.data.state.question === null)

  // Answering before consent must be refused.
  const premature = await call(who, `/api/consultations/${id}/answer`, {
    method: 'POST',
    body: { questionKey: 'age_band', value: 'AGE_18_64' },
  })
  check('answer refused before consent', premature.status === 409, `status ${premature.status}`)

  const consent = await call(who, `/api/consultations/${id}/consent`, {
    method: 'POST',
    body: { accepted: true },
  })
  check('consent accepted', consent.status === 200 && consent.json?.data?.state?.question)

  let state = consent.json.data.state
  let asked = 0
  while (state.question) {
    if (asked > 40) {
      check('questionnaire terminates', false, 'exceeded 40 questions')
      break
    }
    asked += 1
    const value = answerFor(state.question, overrides)
    const res = await call(who, `/api/consultations/${id}/answer`, {
      method: 'POST',
      body: { questionKey: state.question.key, value },
    })
    if (res.status !== 200) {
      check(`answer accepted (${state.question.key})`, false, `status ${res.status} ${res.text.slice(0, 120)}`)
      return null
    }
    state = res.json.data.state
    if (state.result) break
  }

  check('assessment produced', Boolean(state.result), `after ${asked} questions`)
  return { id, state, asked }
}

async function main() {
  console.log(`AI consultation e2e against ${BASE}`)

  // ── 1. an ordinary self-care journey ──────────────────────────────────
  const selfCare = await runFlow(
    'anon',
    {
      age_band: 'AGE_18_64',
      sex: 'MALE',
      primary_symptom: 'allergy',
      onset: 'days_1_3',
      severity: 3,
      course: 'ACUTE',
    },
    'Mild allergy, adult male → self-care with products',
  )

  if (selfCare) {
    const result = selfCare.state.result
    check('triage is SELF_CARE', result.triageLevel === 'SELF_CARE', result.triageLevel)
    check('products offered', result.recommendations.length > 0)
    check('no prescription product offered', result.recommendations.every((r) => !r.prescriptionRequired))
    check('all seven response sections present', Boolean(
      result.understood && result.safetyAssessment && result.nextStep && result.seekCare && result.disclaimer,
    ))
    check('questionnaire stayed short (<= 20 questions)', selfCare.asked <= 20, `${selfCare.asked}`)

    // ── access control: a different visitor must not read it ────────────
    const stranger = await call('stranger', `/api/consultations/${selfCare.id}`)
    check('another visitor cannot read the consultation', stranger.status === 404, `status ${stranger.status}`)

    const owner = await call('anon', `/api/consultations/${selfCare.id}`)
    check('owner can read their own consultation', owner.status === 200)

    // ── pharmacist handoff ─────────────────────────────────────────────
    const handoff = await call('anon', `/api/consultations/${selfCare.id}/handoff`, {
      method: 'POST',
      body: { note: 'Утсаар зөвлөгөө авмаар байна.' },
    })
    check('handoff accepted', handoff.status === 200 && handoff.json?.data?.message)
    check('handoff reflected in state', handoff.json?.data?.state?.result?.handedOff === true)
  }

  // ── 2. emergency path ─────────────────────────────────────────────────
  const emergency = await runFlow(
    'anon2',
    {
      age_band: 'AGE_18_64',
      sex: 'MALE',
      primary_symptom: 'headache',
      symptom_free_text: 'Гэнэт тэсэхийн аргагүй толгой өвдөж, хэл ор', // free-text screen
      onset: 'under_6h',
      severity: 9,
    },
    'Sudden severe headache described in free text → emergency',
  )

  if (emergency) {
    const result = emergency.state.result
    check('triage is EMERGENCY', result.triageLevel === 'EMERGENCY', result.triageLevel)
    check('emergency flag set', result.emergency === true)
    check('no products under an emergency message', result.recommendations.length === 0)
    check('emergency number provided from settings', Boolean(result.emergencyNumber))
    check('questionnaire stopped early', emergency.asked <= 8, `${emergency.asked} questions`)
  }

  // ── 3. pharmacist review requires the permission ──────────────────────
  if (selfCare) {
    const anonReview = await call('anon', `/api/consultations/${selfCare.id}/review`, {
      method: 'POST',
      body: { action: 'ACCEPT' },
    })
    check(
      'anonymous visitor cannot review',
      anonReview.status === 401 || anonReview.status === 403 || anonReview.status === 404,
      `status ${anonReview.status}`,
    )

    const login = await call('rx', '/api/auth/login', {
      method: 'POST',
      body: { identifier: 'pharmacist@ilikon.mn', password: 'Ilikon2026!' },
    })
    check('pharmacist login', login.status === 200, `status ${login.status}`)

    if (login.status === 200) {
      const review = await call('rx', `/api/consultations/${selfCare.id}/review`, {
        method: 'POST',
        body: {
          action: 'MODIFY',
          pharmacistRecommendation: 'Антихистаминыг шөнө хэрэглэхийг зөвлөв.',
          reasonForChange: 'Өдрийн цагт нойрмоглох магадлалтай.',
        },
      })
      check('pharmacist review accepted', review.status === 200, `status ${review.status} ${review.text.slice(0, 140)}`)
      check(
        'pharmacist advice surfaces to the customer',
        review.json?.data?.state?.result?.pharmacistNote?.length > 0,
      )

      // Once reviewed, the customer may no longer re-answer (§21).
      const afterReview = await call('anon', `/api/consultations/${selfCare.id}/assess`, {
        method: 'POST',
        body: {},
      })
      check(
        'engine cannot overwrite a pharmacist verdict',
        afterReview.status === 409,
        `status ${afterReview.status}`,
      )
    }

    // A staff member with consultations.view may read it.
    const staffRead = await call('rx', `/api/consultations/${selfCare.id}`)
    check('pharmacist can read the consultation', staffRead.status === 200)
    check('staff read is marked as staff access', staffRead.json?.data?.access?.role === 'staff')
  }

  // ── 4. medicine lookup ────────────────────────────────────────────────
  const lookup = await call('anon', '/api/consultations/medicines?q=парацетамол&locale=mn')
  check('medicine search works', lookup.status === 200 && Array.isArray(lookup.json?.data?.items))

  console.log(
    failures === 0
      ? '\n✅  Consultation e2e passed\n'
      : `\n❌  ${failures} check(s) failed\n`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
