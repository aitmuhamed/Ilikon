/**
 * Deterministic response wording (§25, §27).
 *
 * Every section the LLM can write has a template here. The templates are not a
 * degraded mode — they are the reference wording, and they are what a customer
 * sees whenever the model is unavailable, disabled, or produced text that
 * failed `validateComposition`. Nothing here contains a dose, a diagnosis, or a
 * product name.
 */

import {
  ONSET_OPTIONS,
  symptomLabel,
  t,
  tr,
  type LocalizedText,
  type TriageLevelKey,
} from './types'

export interface ResponseSections {
  understood: string
  safetyAssessment: string
  nextStep: string
  precautions: string
  seekCare: string
}

// ───────────────────────────── section templates ───────────────────────────

const SAFETY_BY_LEVEL: Record<TriageLevelKey, LocalizedText> = {
  EMERGENCY: t(
    'Таны хэлсэн шинж тэмдэг яаралтай эмнэлгийн үнэлгээ шаардаж болзошгүй байна.',
    'What you have described may require emergency medical assessment.',
    'Описанное вами может требовать экстренной медицинской оценки.',
  ),
  URGENT_MEDICAL_REVIEW: t(
    'Таны хэлсэн байдал эмчийн үзлэгийг хойшлуулахгүй байхыг шаардаж байна. Эмийн сангийн бүтээгдэхүүнээр өөрөө эмчлэх нь тохиромжгүй.',
    'Your situation needs a medical review without delay. Treating it yourself with pharmacy products is not appropriate.',
    'Ваша ситуация требует безотложного осмотра врача. Самолечение аптечными средствами не подходит.',
  ),
  PHARMACIST_CONSULTATION: t(
    'Танд жоргүй бүтээгдэхүүний сонголт байж болох ч мэргэжлийн эм зүйч танай нөхцөлд тохирохыг эхлээд хянах шаардлагатай.',
    'An over-the-counter option may exist, but a pharmacist needs to check that it fits your situation first.',
    'Безрецептурный вариант возможен, но сначала фармацевт должен проверить, подходит ли он вам.',
  ),
  SELF_CARE: t(
    'Таны хэлсэн мэдээлэлд үндэслэвэл өөрөө тусламжийн ерөнхий зөвлөгөө болон жоргүй бүтээгдэхүүний мэдээлэл тохиромжтой байж болно.',
    'Based on what you have told us, general self-care information and over-the-counter guidance may be appropriate.',
    'Судя по вашим ответам, общие рекомендации по самопомощи и безрецептурные средства могут подойти.',
  ),
}

const NEXT_STEP_BY_LEVEL: Record<TriageLevelKey, LocalizedText> = {
  EMERGENCY: t(
    'Иликон эм санал болгохын оронд яаралтай мэргэжлийн тусламж авахыг зөвлөж байна.',
    'Rather than suggesting a medicine, Ilikon advises you to get urgent professional help.',
    'Вместо рекомендации лекарства Иликон советует срочно обратиться за профессиональной помощью.',
  ),
  URGENT_MEDICAL_REVIEW: t(
    'Өнөөдөр эмч, эмнэлэгт хандаж үзлэг хийлгэнэ үү. Шаардлагатай бол эм зүйчтэй холбогдож дэмжлэг авч болно.',
    'Please see a doctor or clinic today. You can also contact our pharmacist for support in the meantime.',
    'Обратитесь к врачу или в клинику сегодня. При необходимости свяжитесь с нашим фармацевтом.',
  ),
  PHARMACIST_CONSULTATION: t(
    'Таны мэдээлэлд үндэслэн эм зүйчтэй зөвлөөд жоргүй бүтээгдэхүүний сонголтыг авч үзэж болно.',
    'Based on your information, consult our pharmacist and then consider the over-the-counter options.',
    'На основании ваших данных проконсультируйтесь с фармацевтом и затем рассмотрите безрецептурные варианты.',
  ),
  SELF_CARE: t(
    'Доорх жоргүй бүтээгдэхүүний сонголтыг харж, савлагааны зааврыг дагана уу. Хэрэв эргэлзвэл эм зүйчээс асуугаарай.',
    'You can review the over-the-counter options below and follow the package instructions. Ask our pharmacist if anything is unclear.',
    'Ознакомьтесь с безрецептурными вариантами ниже и следуйте инструкции на упаковке. При сомнениях спросите фармацевта.',
  ),
}

const LABEL_RULE = t(
  'Эмийг савлагааны заавар эсвэл эм зүйчийн зөвлөмжийн дагуу хэрэглэнэ үү. Ижил идэвхтэй найрлага агуулсан бүтээгдэхүүнийг давхардуулахаас зайлсхийгээрэй.',
  'Use any medicine according to the package label or your pharmacist’s instructions, and avoid doubling up on products that contain the same active ingredient.',
  'Применяйте лекарство согласно инструкции на упаковке или указаниям фармацевта и не совмещайте средства с одинаковым действующим веществом.',
)

const SEEK_CARE_GENERIC = t(
  'Байдал дордвол, 3–5 хоногт сайжрахгүй бол, эсвэл өндөр халуун, амьсгал давчдах, цээж өвдөх, ухаан балартах, цус алдах зэрэг шинж гарвал эмнэлгийн тусламж нэн даруй авна уу.',
  'Seek medical care promptly if you get worse, if there is no improvement within 3–5 days, or if you develop a high fever, breathing difficulty, chest pain, confusion or bleeding.',
  'Немедленно обратитесь за медицинской помощью при ухудшении, отсутствии улучшения за 3–5 дней, а также при высокой температуре, одышке, боли в груди, спутанности сознания или кровотечении.',
)

const SEEK_CARE_EMERGENCY = t(
  'Одоо яаралтай тусламжийн дугаарт холбогдох эсвэл хамгийн ойрын эмнэлгийн яаралтай тасагт хандана уу.',
  'Call the emergency number now, or go to the nearest emergency department.',
  'Позвоните по номеру экстренной службы или обратитесь в ближайшее отделение неотложной помощи.',
)

const UNDERSTOOD_PREFIX = t('Та', 'You reported', 'Вы сообщили о')

const NO_PRODUCTS = t(
  'Одоогийн байдлаар танай нөхцөлд тохирох, батлагдсан заавартай жоргүй бүтээгдэхүүн олдсонгүй. Эм зүйчтэй зөвлөхийг зөвлөж байна.',
  'We did not find an approved over-the-counter option that fits your situation. We recommend speaking with a pharmacist.',
  'Мы не нашли подходящего безрецептурного варианта для вашей ситуации. Рекомендуем обратиться к фармацевту.',
)

// ─────────────────────────────── composition ───────────────────────────────

export interface SummaryInput {
  locale: string
  primarySymptom: string | null
  secondarySymptoms: string[]
  onsetCode: string | null
  severity: number | null
  freeText: string | null
}

/** Neutral restatement of the complaint — never an interpretation of it. */
export function symptomSummary(input: SummaryInput): string {
  const parts: string[] = []
  const primary = symptomLabel(input.primarySymptom, input.locale)
  if (primary) parts.push(primary)
  for (const code of input.secondarySymptoms.slice(0, 4)) {
    parts.push(symptomLabel(code, input.locale))
  }

  const onset = ONSET_OPTIONS.find((o) => o.code === input.onsetCode)
  const segments: string[] = []
  if (parts.length > 0) segments.push(parts.join(', '))
  if (onset) segments.push(tr(onset.label, input.locale))
  if (input.severity !== null) segments.push(`${input.severity}/10`)

  return segments.join(' · ')
}

export function understoodText(input: SummaryInput): string {
  const summary = symptomSummary(input)
  if (!summary) {
    return input.freeText?.slice(0, 200) ?? tr(UNDERSTOOD_PREFIX, input.locale)
  }
  const prefix = tr(UNDERSTOOD_PREFIX, input.locale)
  return input.locale === 'mn'
    ? `${prefix} ${summary} гэсэн зовиурын талаар мэдээлэл өглөө.`
    : `${prefix}: ${summary}.`
}

export interface DeterministicInput extends SummaryInput {
  triageLevel: TriageLevelKey
  triageReason: string
  guidelinePrecaution: string | null
  safetyNotes: string[]
  hasProducts: boolean
  emergencyNumber: string
}

/**
 * Builds all five narrative sections without the model. Used as the fallback
 * and as the reference wording that generated text is compared against.
 */
export function deterministicSections(input: DeterministicInput): ResponseSections {
  const locale = input.locale
  const emergency = input.triageLevel === 'EMERGENCY'

  const precautionParts = [
    ...(input.guidelinePrecaution ? [input.guidelinePrecaution] : []),
    ...input.safetyNotes,
    tr(LABEL_RULE, locale),
  ]

  return {
    understood: understoodText(input),
    safetyAssessment: [tr(SAFETY_BY_LEVEL[input.triageLevel], locale), input.triageReason]
      .filter(Boolean)
      .join(' '),
    nextStep: emergency
      ? tr(NEXT_STEP_BY_LEVEL.EMERGENCY, locale)
      : [
          tr(NEXT_STEP_BY_LEVEL[input.triageLevel], locale),
          input.hasProducts ? '' : tr(NO_PRODUCTS, locale),
        ]
          .filter(Boolean)
          .join(' '),
    precautions: emergency ? '' : precautionParts.join(' '),
    seekCare: emergency
      ? `${tr(SEEK_CARE_EMERGENCY, locale)} (${input.emergencyNumber})`
      : tr(SEEK_CARE_GENERIC, locale),
  }
}

/**
 * The emergency response (§27): short, direct, and with nothing after it. The
 * emergency number comes from settings rather than being hardcoded.
 */
export function emergencyResponse(input: {
  locale: string
  emergencyNumber: string
  emergencyNote: string
  summary: SummaryInput
}): ResponseSections {
  const locale = input.locale
  const headline = t(
    `Таны хэлсэн шинж тэмдэг яаралтай эмнэлгийн үнэлгээ шаарддаг байж болзошгүй. Иликон эм санал болгохын оронд яаралтай мэргэжлийн тусламж авахыг зөвлөж байна. Яаралтай тусламж: ${input.emergencyNumber}.`,
    `The symptoms you described may require urgent medical assessment. Rather than suggesting a medicine, Ilikon advises you to seek urgent professional help. Emergency number: ${input.emergencyNumber}.`,
    `Описанные вами симптомы могут требовать срочной медицинской оценки. Вместо рекомендации лекарства Иликон советует срочно обратиться за профессиональной помощью. Экстренный номер: ${input.emergencyNumber}.`,
  )

  return {
    understood: understoodText(input.summary),
    safetyAssessment: tr(headline, locale),
    nextStep: `${tr(SEEK_CARE_EMERGENCY, locale)} ${input.emergencyNote}`.trim(),
    precautions: '',
    seekCare: `${tr(SEEK_CARE_EMERGENCY, locale)} (${input.emergencyNumber})`,
  }
}

export function labelRuleText(locale: string): string {
  return tr(LABEL_RULE, locale)
}

export function noProductsText(locale: string): string {
  return tr(NO_PRODUCTS, locale)
}

/** Reason line for a product card — why this category may be relevant (§13). */
export function productReason(input: {
  locale: string
  guidelineRationale: string
  ingredientNames: string[]
}): string {
  const ingredients = input.ingredientNames.slice(0, 3).join(', ')
  if (!ingredients) return input.guidelineRationale
  const suffix = t(
    `Үйлчлэгч бодис: ${ingredients}.`,
    `Active ingredient: ${ingredients}.`,
    `Действующее вещество: ${ingredients}.`,
  )
  return `${input.guidelineRationale} ${tr(suffix, input.locale)}`
}
