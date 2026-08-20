/**
 * Shared vocabulary for the AI consultation.
 *
 * Deliberately dependency-free (no Prisma, no `server-only`) so the wizard UI,
 * the admin screens, the seed script and the server engines all describe a
 * symptom, a red flag and a triage level with the same words.
 *
 * Enum-shaped values are typed as string unions matching the Prisma enums
 * rather than importing them, which keeps this module importable from Client
 * Components.
 */

export type Locale3 = 'mn' | 'en' | 'ru'

export interface LocalizedText {
  mn: string
  en: string
  ru: string
}

/** Terse constructor so the catalogues below stay readable. */
export function t(mn: string, en: string, ru: string): LocalizedText {
  return { mn, en, ru }
}

export function tr(text: LocalizedText, locale: string): string {
  if (locale === 'en') return text.en
  if (locale === 'ru') return text.ru
  return text.mn
}

// ─────────────────────────── domain unions ────────────────────────────────

export type ConsultationStepKey =
  | 'CONSENT'
  | 'BASICS'
  | 'COMPLAINT'
  | 'SYMPTOM_DETAILS'
  | 'MEDICAL_HISTORY'
  | 'ALLERGIES'
  | 'MEDICATIONS'
  | 'RED_FLAG_SCREENING'
  | 'RESULT'

export const STEP_ORDER: ConsultationStepKey[] = [
  'CONSENT',
  'BASICS',
  'COMPLAINT',
  'SYMPTOM_DETAILS',
  'MEDICAL_HISTORY',
  'ALLERGIES',
  'MEDICATIONS',
  'RED_FLAG_SCREENING',
  'RESULT',
]

export type TriageLevelKey =
  | 'EMERGENCY'
  | 'URGENT_MEDICAL_REVIEW'
  | 'PHARMACIST_CONSULTATION'
  | 'SELF_CARE'

export type RecommendationTypeKey =
  | 'EMERGENCY_CARE'
  | 'DOCTOR_REVIEW'
  | 'PHARMACIST_CONSULT'
  | 'OTC_GUIDANCE'

export type AgeBandKey =
  | 'UNDER_2'
  | 'AGE_2_5'
  | 'AGE_6_12'
  | 'AGE_13_17'
  | 'AGE_18_64'
  | 'AGE_65_PLUS'

export type SexKey = 'MALE' | 'FEMALE' | 'UNDISCLOSED'

export type PregnancyKey =
  | 'PREGNANT'
  | 'POSSIBLY_PREGNANT'
  | 'BREASTFEEDING'
  | 'NEITHER'
  | 'UNDISCLOSED'

export type CourseKey = 'ACUTE' | 'PERSISTENT' | 'RECURRENT' | 'CHRONIC'

export type InteractionStatusKey = 'SAFE' | 'CAUTION' | 'SIGNIFICANT_RISK' | 'UNKNOWN'

export type RecommendationStatusKey =
  | 'SAFE_TO_SHOW'
  | 'PHARMACIST_REVIEW_REQUIRED'
  | 'BLOCKED'

export type SafetyOutcomeKey = 'PASS' | 'WARN' | 'BLOCK' | 'UNKNOWN'

/** Level 1 is the most urgent; used for ordering and comparisons. */
export const TRIAGE_RANK: Record<TriageLevelKey, 1 | 2 | 3 | 4> = {
  EMERGENCY: 1,
  URGENT_MEDICAL_REVIEW: 2,
  PHARMACIST_CONSULTATION: 3,
  SELF_CARE: 4,
}

/** Returns whichever level is more cautious. Triage only ever escalates. */
export function mostUrgent(a: TriageLevelKey, b: TriageLevelKey): TriageLevelKey {
  return TRIAGE_RANK[a] <= TRIAGE_RANK[b] ? a : b
}

// ───────────────────────── age band handling ──────────────────────────────

export const AGE_BANDS: { key: AgeBandKey; label: LocalizedText; approxYears: number }[] = [
  { key: 'UNDER_2', label: t('2 хүрээгүй', 'Under 2', 'До 2 лет'), approxYears: 1 },
  { key: 'AGE_2_5', label: t('2–5 нас', '2–5 years', '2–5 лет'), approxYears: 4 },
  { key: 'AGE_6_12', label: t('6–12 нас', '6–12 years', '6–12 лет'), approxYears: 9 },
  { key: 'AGE_13_17', label: t('13–17 нас', '13–17 years', '13–17 лет'), approxYears: 15 },
  { key: 'AGE_18_64', label: t('18–64 нас', '18–64 years', '18–64 года'), approxYears: 35 },
  { key: 'AGE_65_PLUS', label: t('65+ нас', '65+ years', '65+ лет'), approxYears: 70 },
]

/**
 * Lower bound of the band, in years. Age contraindications are always checked
 * against the *lowest* age the customer could be, never the average — a "2–5"
 * answer must fail a "not under 3 years" rule.
 */
export function ageBandMinYears(band: AgeBandKey | null | undefined): number | null {
  switch (band) {
    case 'UNDER_2':
      return 0
    case 'AGE_2_5':
      return 2
    case 'AGE_6_12':
      return 6
    case 'AGE_13_17':
      return 13
    case 'AGE_18_64':
      return 18
    case 'AGE_65_PLUS':
      return 65
    default:
      return null
  }
}

export function ageBandMaxYears(band: AgeBandKey | null | undefined): number | null {
  switch (band) {
    case 'UNDER_2':
      return 1
    case 'AGE_2_5':
      return 5
    case 'AGE_6_12':
      return 12
    case 'AGE_13_17':
      return 17
    case 'AGE_18_64':
      return 64
    case 'AGE_65_PLUS':
      return 120
    default:
      return null
  }
}

/** Children and the elderly always need professional review before dosing. */
export function isVulnerableAge(band: AgeBandKey | null | undefined): boolean {
  return band === 'UNDER_2' || band === 'AGE_2_5' || band === 'AGE_6_12' || band === 'AGE_65_PLUS'
}

// ──────────────────────── chronic conditions (§6) ──────────────────────────

export interface ConditionDef {
  code: string
  label: LocalizedText
}

export const CONDITIONS: ConditionDef[] = [
  { code: 'hypertension', label: t('Цусны даралт их', 'Hypertension', 'Гипертония') },
  { code: 'diabetes', label: t('Сахарын шижин', 'Diabetes', 'Диабет') },
  { code: 'asthma', label: t('Астма', 'Asthma', 'Астма') },
  { code: 'heart_disease', label: t('Зүрхний өвчин', 'Heart disease', 'Болезнь сердца') },
  { code: 'kidney_disease', label: t('Бөөрний өвчин', 'Kidney disease', 'Болезнь почек') },
  { code: 'liver_disease', label: t('Элэгний өвчин', 'Liver disease', 'Болезнь печени') },
  { code: 'ulcer', label: t('Ходоодны шархлаа', 'Stomach ulcer', 'Язва желудка') },
  {
    code: 'bleeding_disorder',
    label: t('Цус тогтоох эмгэг', 'Bleeding disorder', 'Нарушение свёртываемости'),
  },
  { code: 'thyroid', label: t('Бамбай булчирхайн эмгэг', 'Thyroid disorder', 'Болезнь щитовидной железы') },
  { code: 'epilepsy', label: t('Таталтын өвчин', 'Epilepsy', 'Эпилепсия') },
  { code: 'glaucoma', label: t('Глауком', 'Glaucoma', 'Глаукома') },
  {
    code: 'prostate',
    label: t('Түрүү булчирхайн томролт', 'Enlarged prostate', 'Увеличение простаты'),
  },
  { code: 'other_chronic', label: t('Бусад архаг өвчин', 'Other chronic condition', 'Другое хроническое заболевание') },
]

export const CONDITION_CODES = CONDITIONS.map((c) => c.code)

/** Conditions that alone are enough to require a pharmacist (§10 level 3). */
export const HIGH_RISK_CONDITIONS = new Set([
  'kidney_disease',
  'liver_disease',
  'heart_disease',
  'bleeding_disorder',
  'ulcer',
  'epilepsy',
])

// ───────────────────────── symptom catalogue (§4) ──────────────────────────

export interface SymptomDef {
  code: string
  label: LocalizedText
  /** lucide icon name rendered by the wizard */
  icon: string
  /** Symptoms where a child presentation is escalated regardless of details. */
  childSensitive?: boolean
}

export const SYMPTOMS: SymptomDef[] = [
  { code: 'headache', label: t('Толгой өвдөх', 'Headache', 'Головная боль'), icon: 'brain' },
  { code: 'fever', label: t('Халуурах', 'Fever', 'Температура'), icon: 'thermometer', childSensitive: true },
  { code: 'cough', label: t('Хөх', 'Cough', 'Кашель'), icon: 'wind' },
  { code: 'sore_throat', label: t('Хоолой өвдөх', 'Sore throat', 'Боль в горле'), icon: 'megaphone' },
  { code: 'runny_nose', label: t('Хамар нусгайрах', 'Runny nose', 'Насморк'), icon: 'droplets' },
  {
    code: 'nasal_congestion',
    label: t('Хамар битүүрэх', 'Nasal congestion', 'Заложенность носа'),
    icon: 'wind',
  },
  {
    code: 'allergy',
    label: t('Харшлын шинж', 'Allergy symptoms', 'Симптомы аллергии'),
    icon: 'flower',
  },
  {
    code: 'stomach_pain',
    label: t('Хэвлий өвдөх', 'Stomach pain', 'Боль в животе'),
    icon: 'circle-dot',
    childSensitive: true,
  },
  { code: 'diarrhea', label: t('Суулгах', 'Diarrhoea', 'Диарея'), icon: 'waves', childSensitive: true },
  { code: 'constipation', label: t('Өтгөн хатах', 'Constipation', 'Запор'), icon: 'minus-circle' },
  { code: 'nausea', label: t('Дотор муухайрах', 'Nausea', 'Тошнота'), icon: 'frown' },
  { code: 'vomiting', label: t('Бөөлжих', 'Vomiting', 'Рвота'), icon: 'arrow-down', childSensitive: true },
  { code: 'heartburn', label: t('Ходоод хорсох', 'Heartburn', 'Изжога'), icon: 'flame' },
  { code: 'muscle_pain', label: t('Булчин өвдөх', 'Muscle pain', 'Боль в мышцах'), icon: 'dumbbell' },
  { code: 'joint_pain', label: t('Үе өвдөх', 'Joint pain', 'Боль в суставах'), icon: 'bone' },
  { code: 'back_pain', label: t('Нуруу өвдөх', 'Back pain', 'Боль в спине'), icon: 'user' },
  {
    code: 'skin_irritation',
    label: t('Арьс цочрох', 'Skin irritation', 'Раздражение кожи'),
    icon: 'hand',
  },
  { code: 'itching', label: t('Арьс тачигнах', 'Itching', 'Зуд'), icon: 'sparkles' },
  { code: 'eye', label: t('Нүдний шинж', 'Eye symptoms', 'Симптомы глаз'), icon: 'eye' },
  { code: 'ear', label: t('Чихний шинж', 'Ear symptoms', 'Симптомы уха'), icon: 'ear' },
  {
    code: 'urinary',
    label: t('Шээсний шинж', 'Urinary symptoms', 'Мочевые симптомы'),
    icon: 'toilet',
  },
  {
    code: 'menstrual',
    label: t('Сарын тэмдгийн шинж', 'Menstrual symptoms', 'Менструальные симптомы'),
    icon: 'calendar-heart',
  },
  { code: 'sleep', label: t('Унтахад хүндрэх', 'Sleep difficulty', 'Проблемы со сном'), icon: 'moon' },
  { code: 'other', label: t('Бусад', 'Other', 'Другое'), icon: 'help-circle' },
]

export const SYMPTOM_CODES = SYMPTOMS.map((s) => s.code)

export function symptomByCode(code: string | null | undefined): SymptomDef | undefined {
  if (!code) return undefined
  return SYMPTOMS.find((s) => s.code === code)
}

export function symptomLabel(code: string | null | undefined, locale: string): string {
  const found = symptomByCode(code)
  return found ? tr(found.label, locale) : (code ?? '')
}

// ───────────────────────── red flag catalogue (§9) ─────────────────────────

export type RedFlagSeverityKey = 'EMERGENCY' | 'URGENT'

export interface RedFlagDef {
  code: string
  label: LocalizedText
  severity: RedFlagSeverityKey
  /** Shown in the general screening checklist rather than only symptom probes. */
  inChecklist?: boolean
}

export const RED_FLAGS: RedFlagDef[] = [
  {
    code: 'breathing_difficulty',
    label: t(
      'Амьсгал давчдах, амьсгалахад хүндрэлтэй',
      'Difficulty breathing',
      'Затруднённое дыхание',
    ),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'chest_pain',
    label: t('Цээж хүчтэй өвдөх', 'Severe chest pain', 'Сильная боль в груди'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'severe_allergic_reaction',
    label: t(
      'Хүчтэй харшлын хариу урвал (хавагнах, залгихад хүндрэх)',
      'Severe allergic reaction (swelling, trouble swallowing)',
      'Тяжёлая аллергическая реакция (отёк, трудно глотать)',
    ),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'loss_of_consciousness',
    label: t('Ухаан алдах', 'Loss of consciousness', 'Потеря сознания'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'seizure',
    label: t('Таталт', 'Seizure', 'Судороги'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'severe_confusion',
    label: t('Хүчтэй эргэлзэл, ухаан балартах', 'Severe confusion', 'Сильная спутанность сознания'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'sudden_weakness',
    label: t(
      'Гэнэтийн хүч дутагдал, мэдээ алдах',
      'Sudden weakness or numbness',
      'Внезапная слабость или онемение',
    ),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'speech_difficulty',
    label: t('Гэнэт хэл ярианд хүндрэх', 'Sudden difficulty speaking', 'Внезапное нарушение речи'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'sudden_severe_headache',
    label: t(
      'Гэнэт хүчтэй толгой өвдөх',
      'Sudden severe headache',
      'Внезапная сильная головная боль',
    ),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'severe_bleeding',
    label: t('Их хэмжээний цус алдалт', 'Severe bleeding', 'Сильное кровотечение'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'vomiting_blood',
    label: t('Цус бөөлжих', 'Vomiting blood', 'Рвота с кровью'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'black_stool',
    label: t('Хар, давирхай шиг өтгөн', 'Black or tarry stool', 'Чёрный дегтеобразный стул'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'severe_dehydration',
    label: t(
      'Хүчтэй шүүс дутагдал (шээс гарахгүй, ухаан бүрхэг)',
      'Severe dehydration (no urine, drowsiness)',
      'Тяжёлое обезвоживание (нет мочи, вялость)',
    ),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'severe_abdominal_pain',
    label: t('Хэвлий хүчтэй өвдөх', 'Severe abdominal pain', 'Сильная боль в животе'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'serious_injury',
    label: t('Хүнд гэмтэл', 'Serious injury', 'Серьёзная травма'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'suspected_poisoning',
    label: t('Хордлого сэжиглэх', 'Suspected poisoning', 'Подозрение на отравление'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'overdose',
    label: t('Эм хэтрүүлэн хэрэглэх', 'Medicine overdose', 'Передозировка лекарства'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'suicidal_thoughts',
    label: t('Амиа хорлох санаа', 'Suicidal thoughts', 'Мысли о самоубийстве'),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'infant_severe',
    label: t(
      'Хүүхэд (нэг нас хүрээгүй) хүнд шинж тэмдэгтэй',
      'Severe symptoms in an infant',
      'Тяжёлые симптомы у младенца',
    ),
    severity: 'EMERGENCY',
    inChecklist: true,
  },
  {
    code: 'stiff_neck_rash',
    label: t(
      'Хүзүү хөшиж, халуурч, тууралт гарах',
      'Stiff neck with fever and rash',
      'Скованность шеи с температурой и сыпью',
    ),
    severity: 'EMERGENCY',
    inChecklist: true,
  },

  // Symptom probes — serious, but level 2 rather than level 1.
  {
    code: 'vision_change',
    label: t('Харах чадвар өөрчлөгдөх', 'Vision changes', 'Изменения зрения'),
    severity: 'URGENT',
  },
  {
    code: 'head_injury_recent',
    label: t('Сүүлд толгой цохисон', 'Recent head injury', 'Недавняя травма головы'),
    severity: 'URGENT',
  },
  {
    code: 'blood_in_sputum',
    label: t('Цэрэнд цус холилдох', 'Blood in mucus', 'Кровь в мокроте'),
    severity: 'URGENT',
  },
  {
    code: 'blood_in_stool',
    label: t('Өтгөнд цус холилдох', 'Blood in stool', 'Кровь в стуле'),
    severity: 'URGENT',
  },
  {
    code: 'blood_in_urine',
    label: t('Шээсэнд цус холилдох', 'Blood in urine', 'Кровь в моче'),
    severity: 'URGENT',
  },
  {
    code: 'high_fever_persistent',
    label: t(
      '39°C-аас дээш халуун 3 хоногоос дээш',
      'Fever above 39°C for more than 3 days',
      'Температура выше 39°C более 3 дней',
    ),
    severity: 'URGENT',
  },
  {
    code: 'eye_injury',
    label: t('Нүдний гэмтэл, харалган болох', 'Eye injury or vision loss', 'Травма глаза или потеря зрения'),
    severity: 'URGENT',
  },
  {
    code: 'unexplained_weight_loss',
    label: t('Шалтгаангүй турах', 'Unexplained weight loss', 'Необъяснимая потеря веса'),
    severity: 'URGENT',
  },
  {
    code: 'pregnancy_abdominal_pain',
    label: t(
      'Жирэмсэн үед хэвлий өвдөх, цус гарах',
      'Abdominal pain or bleeding during pregnancy',
      'Боль в животе или кровотечение при беременности',
    ),
    severity: 'URGENT',
  },
]

export const RED_FLAG_BY_CODE = new Map(RED_FLAGS.map((f) => [f.code, f]))

export function redFlagLabel(code: string, locale: string): string {
  const found = RED_FLAG_BY_CODE.get(code)
  return found ? tr(found.label, locale) : code
}

export const CHECKLIST_RED_FLAGS = RED_FLAGS.filter((f) => f.inChecklist)

// ───────────────────────────── onset options ───────────────────────────────

export interface OnsetDef {
  code: string
  label: LocalizedText
  /** Representative duration used by the duration/course logic. */
  hours: number
}

export const ONSET_OPTIONS: OnsetDef[] = [
  { code: 'under_6h', label: t('6 цагаас бага', 'Less than 6 hours', 'Менее 6 часов'), hours: 3 },
  { code: 'today', label: t('Өнөөдөр', 'Today', 'Сегодня'), hours: 12 },
  { code: 'days_1_3', label: t('1–3 хоног', '1–3 days', '1–3 дня'), hours: 48 },
  { code: 'days_4_7', label: t('4–7 хоног', '4–7 days', '4–7 дней'), hours: 132 },
  { code: 'weeks_1_4', label: t('1–4 долоо хоног', '1–4 weeks', '1–4 недели'), hours: 420 },
  { code: 'over_month', label: t('1 сараас дээш', 'More than a month', 'Более месяца'), hours: 1200 },
]

export function onsetHours(code: string | null | undefined): number | null {
  return ONSET_OPTIONS.find((o) => o.code === code)?.hours ?? null
}

// ─────────────────────── wire formats (API ⇄ wizard) ───────────────────────

export type QuestionType =
  | 'single'
  | 'multi'
  | 'scale'
  | 'text'
  | 'number'
  | 'boolean'
  | 'medications'
  | 'allergies'

/** A question already resolved into the customer's language. */
export interface WireQuestion {
  key: string
  step: ConsultationStepKey
  type: QuestionType
  prompt: string
  help: string | null
  optional: boolean
  isRedFlagProbe: boolean
  min: number | null
  max: number | null
  options: { value: string; label: string; hint: string | null }[]
  /** Percentage of the questionnaire completed, for the progress bar. */
  progress: number
}

export interface WireRecommendation {
  id: string
  productId: string | null
  slug: string | null
  name: string
  categoryName: string | null
  activeIngredients: string | null
  dosageForm: string | null
  strength: string | null
  packageSize: string | null
  price: number | null
  imageUrl: string | null
  inStock: boolean
  stock: number | null
  prescriptionRequired: boolean
  reason: string | null
  safetyNotes: string | null
  status: RecommendationStatusKey
  interactionStatus: InteractionStatusKey
  addedByPharmacist: boolean
  /** Traceability shown to staff, and on the customer card as a source note. */
  sourceLabel: string | null
}

export interface WireSafetyNotice {
  type: string
  outcome: SafetyOutcomeKey
  code: string
  message: string
  productName: string | null
}

/** The §25 seven-part response, plus the machine-readable parts around it. */
export interface WireResult {
  consultationId: string
  code: string
  locale: Locale3
  triageLevel: TriageLevelKey
  recommendationType: RecommendationTypeKey
  triageReason: string | null
  understood: string
  safetyAssessment: string
  nextStep: string
  precautions: string
  seekCare: string
  emergency: boolean
  emergencyNumber: string
  redFlags: { code: string; label: string; severity: RedFlagSeverityKey }[]
  recommendations: WireRecommendation[]
  notices: WireSafetyNotice[]
  duplicateIngredientWarning: string | null
  pharmacistReviewRequired: boolean
  handedOff: boolean
  pharmacistNote: string | null
  symptomSummary: string
  disclaimer: string
}

export interface WireState {
  consultationId: string
  code: string
  status: string
  step: ConsultationStepKey
  locale: Locale3
  consentAccepted: boolean
  question: WireQuestion | null
  answered: { key: string; label: string | null; questionText: string }[]
  result: WireResult | null
}
