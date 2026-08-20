/**
 * The adaptive questionnaire (§3–§7, §9).
 *
 * Two rules shape this module:
 *
 *  1. ONE QUESTION AT A TIME. `nextQuestion` returns the first applicable
 *     question that has no answer yet. The browser never receives the whole
 *     tree, so it cannot skip a screening question by not rendering it.
 *  2. RED FLAGS SHORT-CIRCUIT. As soon as an answer sets an EMERGENCY-severity
 *     red flag, the questionnaire is over — asking a person with chest pain
 *     eight more questions about their medication list is the wrong behaviour.
 *
 * The catalogue is pure data. Answer parsing lives here too so the API route
 * cannot accept a shape the question never offered.
 */

import {
  CHECKLIST_RED_FLAGS,
  CONDITIONS,
  ONSET_OPTIONS,
  RED_FLAG_BY_CODE,
  SYMPTOMS,
  type AgeBandKey,
  type ConsultationStepKey,
  type LocalizedText,
  type PregnancyKey,
  type QuestionType,
  type SexKey,
  type WireQuestion,
  AGE_BANDS,
  t,
  tr,
} from './types'

/** Version stamped onto every consultation for auditability (§29). */
export const QUESTIONNAIRE_VERSION = 'q-2026.08.1'

export interface OptionDef {
  value: string
  label: LocalizedText
  hint?: LocalizedText
  /** Red flag raised when this option is selected. */
  redFlag?: string
}

export interface QuestionDef {
  key: string
  step: ConsultationStepKey
  type: QuestionType
  prompt: LocalizedText
  help?: LocalizedText
  options?: OptionDef[]
  min?: number
  max?: number
  optional?: boolean
  isRedFlagProbe?: boolean
  /** Only asked when this returns true for the current answers. */
  when?: (state: AnswerState) => boolean
}

/**
 * Everything the engine knows about the customer so far. Mirrors the columns
 * on `Consultation` plus its child rows.
 */
export interface AnswerState {
  ageBand: AgeBandKey | null
  exactAgeYears: number | null
  exactAgeMonths: number | null
  sex: SexKey | null
  pregnancy: PregnancyKey | null
  primarySymptom: string | null
  symptomFreeText: string | null
  secondarySymptoms: string[]
  onsetCode: string | null
  severity: number | null
  course: string | null
  worsening: boolean | null
  conditions: string[]
  allergyDeclared: 'yes' | 'no' | 'unknown' | null
  allergies: { medication: string; reaction: string | null }[]
  medications: { name: string; dose: string | null; frequency: string | null }[]
  /** Raw answers keyed by question key — drives `when` predicates. */
  answers: Record<string, unknown>
  redFlagCodes: string[]
}

export function emptyState(): AnswerState {
  return {
    ageBand: null,
    exactAgeYears: null,
    exactAgeMonths: null,
    sex: null,
    pregnancy: null,
    primarySymptom: null,
    symptomFreeText: null,
    secondarySymptoms: [],
    onsetCode: null,
    severity: null,
    course: null,
    worsening: null,
    conditions: [],
    allergyDeclared: null,
    allergies: [],
    medications: [],
    answers: {},
    redFlagCodes: [],
  }
}

// ───────────────────────────── option presets ──────────────────────────────

const YES = t('Тийм', 'Yes', 'Да')
const NO = t('Үгүй', 'No', 'Нет')
const UNSURE = t('Мэдэхгүй', 'Not sure', 'Не знаю')

/**
 * A yes / no / not-sure question. When `redFlagOnYes` is set, answering "yes"
 * raises that red flag; "not sure" never raises one but is carried into the
 * assessment so an unclear answer can still force pharmacist review.
 */
function bool(
  key: string,
  step: ConsultationStepKey,
  prompt: LocalizedText,
  extra: {
    redFlagOnYes?: string
    help?: LocalizedText
    when?: (s: AnswerState) => boolean
    optional?: boolean
  } = {},
): QuestionDef {
  return {
    key,
    step,
    type: 'single',
    prompt,
    help: extra.help,
    when: extra.when,
    optional: extra.optional,
    isRedFlagProbe: Boolean(extra.redFlagOnYes),
    options: [
      { value: 'yes', label: YES, redFlag: extra.redFlagOnYes },
      { value: 'no', label: NO },
      { value: 'unknown', label: UNSURE },
    ],
  }
}

function symptomIs(...codes: string[]) {
  return (s: AnswerState) =>
    codes.includes(s.primarySymptom ?? '') || codes.some((c) => s.secondarySymptoms.includes(c))
}

/**
 * One multi-select screening question per symptom instead of a chain of yes/no
 * probes.
 *
 * This is a deliberate trade of question count against completion: asking a
 * headache patient nine separate yes/no questions pushed the questionnaire past
 * twenty questions, and an abandoned consultation screens nobody. Every option
 * still carries its own red flag, so the screening coverage is identical — the
 * customer just answers it in one screen.
 *
 * Left `optional` so "none of these" is expressed by submitting nothing; the
 * general checklist in step 7 asks the emergency list again regardless.
 */
function warningSigns(
  key: string,
  when: (s: AnswerState) => boolean,
  options: OptionDef[],
): QuestionDef {
  return {
    key,
    step: 'SYMPTOM_DETAILS',
    type: 'multi',
    optional: true,
    isRedFlagProbe: true,
    when,
    prompt: t(
      'Дараахаас ямар нэг шинж тэмдэг хамт байвал сонгоно уу',
      'Select any of these that you also have',
      'Отметьте всё, что у вас также есть',
    ),
    help: t(
      'Аль нь ч байхгүй бол шууд үргэлжлүүлээрэй.',
      'Continue without selecting anything if none apply.',
      'Продолжите без выбора, если ничего не подходит.',
    ),
    options,
  }
}

// ─────────────────────── step 1: basic information ─────────────────────────

const BASICS: QuestionDef[] = [
  {
    key: 'age_band',
    step: 'BASICS',
    type: 'single',
    prompt: t('Өвчтөний нас хэд вэ?', 'How old is the patient?', 'Сколько лет пациенту?'),
    help: t(
      'Нас нь эмийн аюулгүй байдалд шууд нөлөөлдөг тул шаардлагатай.',
      'Age directly affects medicine safety, so it is required.',
      'Возраст напрямую влияет на безопасность лекарств.',
    ),
    options: AGE_BANDS.map((b) => ({ value: b.key, label: b.label })),
  },
  {
    key: 'exact_age',
    step: 'BASICS',
    type: 'number',
    min: 0,
    max: 120,
    prompt: t('Тодорхой насыг бичнэ үү (бүтэн жилээр)', 'Please enter the exact age in years', 'Укажите точный возраст в годах'),
    help: t(
      'Бага насны хүүхэд, ахимаг насны хүнд эмийн тун онцгой хамаардаг тул тодорхой нас шаардлагатай.',
      'Exact age is required for young children and older adults, where dosing limits are strict.',
      'Точный возраст необходим для детей и пожилых людей.',
    ),
    // Only the bands where a year of difference changes the safety answer.
    when: (s) => s.ageBand === 'UNDER_2' || s.ageBand === 'AGE_2_5' || s.ageBand === 'AGE_65_PLUS',
  },
  {
    key: 'sex',
    step: 'BASICS',
    type: 'single',
    prompt: t('Хүйс', 'Sex', 'Пол'),
    help: t(
      'Зөвхөн эмнэлзүйн шаардлагатай үед л хэрэглэнэ.',
      'Used only where it is clinically relevant.',
      'Используется только при клинической необходимости.',
    ),
    optional: true,
    options: [
      { value: 'MALE', label: t('Эрэгтэй', 'Male', 'Мужской') },
      { value: 'FEMALE', label: t('Эмэгтэй', 'Female', 'Женский') },
      { value: 'UNDISCLOSED', label: t('Хэлэхийг хүсэхгүй', 'Prefer not to say', 'Предпочитаю не отвечать') },
    ],
  },
  {
    key: 'pregnancy',
    step: 'BASICS',
    type: 'single',
    prompt: t(
      'Жирэмсэн эсвэл хөхүүл эсэх',
      'Pregnancy or breastfeeding status',
      'Беременность или кормление грудью',
    ),
    help: t(
      'Жирэмсэн, хөхүүл эхэд аюулгүй эмийн сонголт өөр байдаг тул асууж байна.',
      'Safe options differ during pregnancy and breastfeeding.',
      'Безопасные варианты отличаются при беременности и кормлении.',
    ),
    optional: true,
    // Never assumed — only offered where it is plausible, and always skippable.
    when: (s) =>
      s.sex === 'FEMALE' &&
      (s.ageBand === 'AGE_13_17' || s.ageBand === 'AGE_18_64'),
    options: [
      { value: 'PREGNANT', label: t('Жирэмсэн', 'Pregnant', 'Беременна') },
      {
        value: 'POSSIBLY_PREGNANT',
        label: t('Жирэмсэн байж магадгүй', 'Possibly pregnant', 'Возможно беременна'),
      },
      { value: 'BREASTFEEDING', label: t('Хөхүүл', 'Breastfeeding', 'Кормлю грудью') },
      { value: 'NEITHER', label: t('Аль нь ч биш', 'Neither', 'Ни то, ни другое') },
      {
        value: 'UNDISCLOSED',
        label: t('Хэлэхийг хүсэхгүй', 'Prefer not to say', 'Предпочитаю не отвечать'),
      },
    ],
  },
]

// ───────────────────────── step 2: main complaint ──────────────────────────

const COMPLAINT: QuestionDef[] = [
  {
    key: 'primary_symptom',
    step: 'COMPLAINT',
    type: 'single',
    prompt: t('Танд яг ямар зовиур байна вэ?', 'What is your main complaint?', 'Что вас беспокоит?'),
    options: SYMPTOMS.map((s) => ({ value: s.code, label: s.label })),
  },
  {
    key: 'symptom_free_text',
    step: 'COMPLAINT',
    type: 'text',
    max: 600,
    optional: true,
    prompt: t(
      'Зовиураа өөрийн үгээр тайлбарлана уу',
      'Describe your symptoms in your own words',
      'Опишите симптомы своими словами',
    ),
    help: t(
      'Хүссэн бол дэлгэрэнгүй бичээрэй. Энэ нь бидэнд илүү сайн ойлгоход тусална.',
      'Optional, but the detail helps us understand your situation.',
      'Необязательно, но детали помогут нам понять ситуацию.',
    ),
  },
  {
    key: 'secondary_symptoms',
    step: 'COMPLAINT',
    type: 'multi',
    optional: true,
    prompt: t(
      'Хамт байгаа бусад зовиур байвал сонгоно уу',
      'Select any other symptoms you also have',
      'Выберите другие имеющиеся симптомы',
    ),
    options: SYMPTOMS.filter((s) => s.code !== 'other').map((s) => ({ value: s.code, label: s.label })),
  },
]

// ───────────────────── step 3: shared symptom details ──────────────────────

const DETAILS_COMMON: QuestionDef[] = [
  {
    key: 'onset',
    step: 'SYMPTOM_DETAILS',
    type: 'single',
    prompt: t('Хэзээнээс эхэлсэн вэ?', 'When did it start?', 'Когда это началось?'),
    options: ONSET_OPTIONS.map((o) => ({ value: o.code, label: o.label })),
  },
  {
    key: 'severity',
    step: 'SYMPTOM_DETAILS',
    type: 'scale',
    min: 0,
    max: 10,
    prompt: t(
      'Хүндрэлийг 0–10 хооронд үнэлнэ үү',
      'How severe is it, from 0 to 10?',
      'Оцените тяжесть от 0 до 10',
    ),
    help: t(
      '0 — зовиургүй, 10 — хамгийн хүчтэй.',
      '0 means no discomfort, 10 means the worst imaginable.',
      '0 — нет дискомфорта, 10 — максимально сильно.',
    ),
  },
  {
    key: 'course',
    step: 'SYMPTOM_DETAILS',
    type: 'single',
    prompt: t('Хэрхэн явагдаж байна вэ?', 'How has it been progressing?', 'Как это протекает?'),
    options: [
      {
        value: 'ACUTE',
        label: t('Шинээр, цөөн хоног', 'New, only a few days', 'Недавно, несколько дней'),
      },
      {
        value: 'PERSISTENT',
        label: t('Тасралтгүй үргэлжилсээр', 'Continuous and ongoing', 'Продолжается непрерывно'),
      },
      {
        value: 'RECURRENT',
        label: t('Дахин дахин давтагдана', 'Comes back repeatedly', 'Повторяется снова'),
      },
      {
        value: 'CHRONIC',
        label: t('Урт хугацаанд, архаг', 'Long-standing / chronic', 'Длительно, хронически'),
      },
    ],
  },
  bool(
    'worsening',
    'SYMPTOM_DETAILS',
    t('Байдал дордож байна уу?', 'Is it getting worse?', 'Становится ли хуже?'),
  ),
  {
    key: 'meds_already_taken',
    step: 'SYMPTOM_DETAILS',
    type: 'text',
    max: 300,
    optional: true,
    prompt: t(
      'Одоог хүртэл ямар эм хэрэглэсэн бэ?',
      'What medications have you already taken for this?',
      'Какие лекарства вы уже принимали?',
    ),
    help: t(
      'Хэрэглээгүй бол хоосон орхиж болно.',
      'Leave empty if none.',
      'Оставьте пустым, если никаких.',
    ),
  },
]

// ──────────────── step 3: symptom-specific follow-ups (§5) ─────────────────

const DETAILS_BY_SYMPTOM: QuestionDef[] = [
  // ── headache ──────────────────────────────────────────────────────────
  {
    key: 'headache_location',
    step: 'SYMPTOM_DETAILS',
    type: 'single',
    when: symptomIs('headache'),
    prompt: t('Өвдөлт хаана байна вэ?', 'Where is the pain?', 'Где болит?'),
    options: [
      { value: 'one_side', label: t('Нэг тал', 'One side', 'С одной стороны') },
      { value: 'both_sides', label: t('Хоёр тал', 'Both sides', 'С двух сторон') },
      { value: 'forehead', label: t('Дух, хөмсөг хавь', 'Forehead / around the eyes', 'Лоб, вокруг глаз') },
      { value: 'back_head', label: t('Дагзны хэсэг', 'Back of the head', 'Затылок') },
      { value: 'whole_head', label: t('Толгой бүхэлдээ', 'The whole head', 'Вся голова') },
    ],
  },
  {
    key: 'headache_onset_type',
    step: 'SYMPTOM_DETAILS',
    type: 'single',
    when: symptomIs('headache'),
    isRedFlagProbe: true,
    prompt: t(
      'Гэнэт эхэлсэн үү, аажим үү?',
      'Was it sudden or gradual?',
      'Началось внезапно или постепенно?',
    ),
    options: [
      {
        value: 'thunderclap',
        label: t(
          'Гэнэт, хэдхэн секундэд хамгийн хүчтэй болсон',
          'Suddenly — worst pain within seconds',
          'Внезапно — максимум боли за секунды',
        ),
        redFlag: 'sudden_severe_headache',
      },
      { value: 'sudden', label: t('Гэнэт', 'Sudden', 'Внезапно') },
      { value: 'gradual', label: t('Аажмаар', 'Gradual', 'Постепенно') },
      {
        value: 'first_ever',
        label: t(
          'Анх удаа, ийм өвдөлт өмнө байгаагүй',
          'For the first time — never had this before',
          'Впервые — такого раньше не было',
        ),
      },
    ],
  },
  warningSigns('headache_warning_signs', symptomIs('headache'), [
    { value: 'fever', label: t('Халуурах', 'Fever', 'Температура') },
    { value: 'vomiting', label: t('Бөөлжих', 'Vomiting', 'Рвота') },
    {
      value: 'vision',
      label: t('Харах чадвар өөрчлөгдөх', 'Vision changes', 'Изменения зрения'),
      redFlag: 'vision_change',
    },
    {
      value: 'weakness',
      label: t(
        'Гар, хөл сульдах эсвэл мэдээ алдах',
        'Weakness or numbness in an arm or leg',
        'Слабость или онемение в руке или ноге',
      ),
      redFlag: 'sudden_weakness',
    },
    {
      value: 'confusion',
      label: t('Ухаан балартах', 'Confusion', 'Спутанность сознания'),
      redFlag: 'severe_confusion',
    },
    {
      value: 'speech',
      label: t('Хэл ярианд хүндрэх', 'Difficulty speaking', 'Нарушение речи'),
      redFlag: 'speech_difficulty',
    },
    {
      value: 'stiff_neck',
      label: t('Хүзүү хөших, тууралт', 'Stiff neck or a rash', 'Скованность шеи или сыпь'),
      redFlag: 'stiff_neck_rash',
    },
    {
      value: 'head_injury',
      label: t('Сүүлд толгойгоо цохисон', 'A recent head injury', 'Недавняя травма головы'),
      redFlag: 'head_injury_recent',
    },
  ]),

  // ── cough ─────────────────────────────────────────────────────────────
  {
    key: 'cough_type',
    step: 'SYMPTOM_DETAILS',
    type: 'single',
    when: symptomIs('cough'),
    prompt: t('Хуурай хөх үү, цэртэй үү?', 'Is the cough dry or productive?', 'Кашель сухой или с мокротой?'),
    options: [
      { value: 'dry', label: t('Хуурай', 'Dry', 'Сухой') },
      { value: 'productive', label: t('Цэртэй', 'Productive (with mucus)', 'С мокротой') },
      { value: 'mixed', label: t('Хоёул', 'Both', 'И то и другое') },
    ],
  },
  {
    key: 'cough_mucus_color',
    step: 'SYMPTOM_DETAILS',
    type: 'single',
    when: (s) =>
      symptomIs('cough')(s) &&
      (s.answers.cough_type === 'productive' || s.answers.cough_type === 'mixed'),
    prompt: t('Цэрний өнгө ямар байна вэ?', 'What colour is the mucus?', 'Какого цвета мокрота?'),
    options: [
      { value: 'clear', label: t('Тунгалаг', 'Clear', 'Прозрачная') },
      { value: 'white', label: t('Цагаан', 'White', 'Белая') },
      { value: 'yellow', label: t('Шаргал', 'Yellow', 'Жёлтая') },
      { value: 'green', label: t('Хөх ногоон', 'Green', 'Зелёная') },
      { value: 'rusty', label: t('Хүрэн, ягаан', 'Rust or pink coloured', 'Ржавая или розовая') },
    ],
  },
  warningSigns('cough_warning_signs', symptomIs('cough'), [
    { value: 'fever', label: t('Халуурах', 'Fever', 'Температура') },
    {
      value: 'breathless',
      label: t('Амьсгал давчдах', 'Shortness of breath', 'Одышка'),
      redFlag: 'breathing_difficulty',
    },
    {
      value: 'chest_pain',
      label: t('Цээж өвдөх', 'Chest pain', 'Боль в груди'),
      redFlag: 'chest_pain',
    },
    { value: 'wheezing', label: t('Амьсгалахад шуугих', 'Wheezing', 'Свистящее дыхание') },
    {
      value: 'blood',
      label: t('Цэрэнд цус холилдох', 'Blood in the mucus', 'Кровь в мокроте'),
      redFlag: 'blood_in_sputum',
    },
    {
      value: 'weight_loss',
      label: t('Шалтгаангүй турах', 'Unexplained weight loss', 'Необъяснимая потеря веса'),
      redFlag: 'unexplained_weight_loss',
    },
  ]),
  {
    key: 'cough_risk_factors',
    step: 'SYMPTOM_DETAILS',
    type: 'multi',
    optional: true,
    when: symptomIs('cough'),
    prompt: t(
      'Дараах нь танд хамаарах эсэхийг сонгоно уу',
      'Select anything that applies to you',
      'Отметьте, что относится к вам',
    ),
    options: [
      { value: 'smoking', label: t('Тамхи эсвэл вейп татдаг', 'I smoke or vape', 'Курю или вейпю') },
      {
        value: 'asthma',
        label: t('Астма, уушгины архаг өвчин', 'Asthma or chronic lung disease', 'Астма или ХОБЛ'),
      },
      {
        value: 'recent_infection',
        label: t('Сүүлд ханиад, томуу туссан', 'A recent cold or flu', 'Недавняя простуда или грипп'),
      },
    ],
  },

  // ── fever ─────────────────────────────────────────────────────────────
  {
    key: 'fever_temperature',
    step: 'SYMPTOM_DETAILS',
    type: 'number',
    min: 34,
    max: 43,
    optional: true,
    when: symptomIs('fever'),
    prompt: t('Хэмжсэн халуун (°C)', 'Measured temperature (°C)', 'Измеренная температура (°C)'),
    help: t('Хэмжээгүй бол хоосон орхино уу.', 'Leave empty if not measured.', 'Оставьте пустым, если не измеряли.'),
  },
  warningSigns('fever_warning_signs', symptomIs('fever'), [
    {
      value: 'stiff_neck',
      label: t('Хүзүү хөших, тууралт', 'Stiff neck or a rash', 'Скованность шеи или сыпь'),
      redFlag: 'stiff_neck_rash',
    },
    {
      value: 'breathing',
      label: t('Амьсгалахад хүндрэх', 'Difficulty breathing', 'Затруднённое дыхание'),
      redFlag: 'breathing_difficulty',
    },
    {
      value: 'confusion',
      label: t('Ухаан балартах', 'Confusion', 'Спутанность сознания'),
      redFlag: 'severe_confusion',
    },
    {
      value: 'no_fluids',
      label: t(
        'Шингэн ууж чадахгүй, шээс багассан',
        'Unable to drink, passing little urine',
        'Не может пить, мало мочи',
      ),
      redFlag: 'severe_dehydration',
    },
    {
      value: 'seizure',
      label: t('Таталт', 'A seizure', 'Судороги'),
      redFlag: 'seizure',
    },
  ]),

  // ── sore throat ───────────────────────────────────────────────────────
  warningSigns('throat_warning_signs', symptomIs('sore_throat'), [
    {
      value: 'cannot_swallow',
      label: t(
        'Шүлс залгиж чадахгүй, шүлс гоожих',
        'Cannot swallow saliva, or drooling',
        'Не могу сглотнуть слюну, слюнотечение',
      ),
      redFlag: 'severe_allergic_reaction',
    },
    {
      value: 'breathing',
      label: t('Амьсгалахад хүндрэх', 'Difficulty breathing', 'Затруднённое дыхание'),
      redFlag: 'breathing_difficulty',
    },
    { value: 'fever', label: t('Халуурах', 'Fever', 'Температура') },
    {
      value: 'patches',
      label: t('Хоолойд цагаан бүрхүүл', 'White patches on the tonsils', 'Белый налёт на миндалинах'),
    },
    {
      value: 'one_sided_swelling',
      label: t('Нэг тал хавдаж, дуу хоолой сөөх', 'One-sided swelling or a muffled voice', 'Односторонний отёк или глухой голос'),
      redFlag: 'severe_allergic_reaction',
    },
  ]),

  // ── diarrhoea and vomiting ────────────────────────────────────────────
  {
    key: 'diarrhea_frequency',
    step: 'SYMPTOM_DETAILS',
    type: 'single',
    when: symptomIs('diarrhea'),
    prompt: t('Хоногт хэдэн удаа явж байна вэ?', 'How many times a day?', 'Сколько раз в день?'),
    options: [
      { value: 'lt_4', label: t('4-өөс бага', 'Fewer than 4', 'Менее 4') },
      { value: '4_6', label: t('4–6', '4–6', '4–6') },
      { value: 'gt_6', label: t('6-аас их', 'More than 6', 'Более 6') },
    ],
  },
  warningSigns('gi_warning_signs', symptomIs('diarrhea', 'vomiting'), [
    {
      value: 'blood_stool',
      label: t('Өтгөнд цус холилдох', 'Blood in the stool', 'Кровь в стуле'),
      redFlag: 'blood_in_stool',
    },
    {
      value: 'black_stool',
      label: t('Хар, давирхай шиг өтгөн', 'Black or tarry stool', 'Чёрный дегтеобразный стул'),
      redFlag: 'black_stool',
    },
    {
      value: 'blood_vomit',
      label: t('Бөөлжис цустай', 'Blood in the vomit', 'Кровь в рвоте'),
      redFlag: 'vomiting_blood',
    },
    {
      value: 'dehydration',
      label: t(
        'Шээс багассан, хэл хуурайшсан, ухаан бүрхэг',
        'Little urine, dry mouth or drowsiness',
        'Мало мочи, сухость во рту или вялость',
      ),
      redFlag: 'severe_dehydration',
    },
    {
      value: 'severe_pain',
      label: t('Хэвлий тэсэхийн аргагүй өвдөх', 'Unbearable abdominal pain', 'Невыносимая боль в животе'),
      redFlag: 'severe_abdominal_pain',
    },
    { value: 'fever', label: t('Халуурах', 'Fever', 'Температура') },
  ]),

  // ── abdominal pain ────────────────────────────────────────────────────
  {
    key: 'abdomen_location',
    step: 'SYMPTOM_DETAILS',
    type: 'single',
    when: symptomIs('stomach_pain'),
    prompt: t('Өвдөлт хаана байна вэ?', 'Where is the pain?', 'Где болит?'),
    options: [
      { value: 'upper', label: t('Дээд хэсэг', 'Upper abdomen', 'Верхняя часть') },
      { value: 'lower_right', label: t('Доод, баруун тал', 'Lower right', 'Внизу справа') },
      { value: 'lower_left', label: t('Доод, зүүн тал', 'Lower left', 'Внизу слева') },
      { value: 'around_navel', label: t('Хүйсний хавь', 'Around the navel', 'Вокруг пупка') },
      { value: 'whole', label: t('Хэвлий бүхэлдээ', 'The whole abdomen', 'Весь живот') },
    ],
  },
  warningSigns('abdomen_warning_signs', symptomIs('stomach_pain', 'heartburn', 'constipation'), [
    {
      value: 'rigid',
      label: t(
        'Хэвлий хөшиж, хүрэхэд тэсэхийн аргагүй өвдөх',
        'A rigid abdomen that is unbearable to touch',
        'Твёрдый живот, невыносимо больно при касании',
      ),
      redFlag: 'severe_abdominal_pain',
    },
    {
      value: 'black_stool',
      label: t('Хар, давирхай шиг өтгөн', 'Black or tarry stool', 'Чёрный дегтеобразный стул'),
      redFlag: 'black_stool',
    },
    {
      value: 'blood_vomit',
      label: t('Цус бөөлжих', 'Vomiting blood', 'Рвота с кровью'),
      redFlag: 'vomiting_blood',
    },
    {
      value: 'weight_loss',
      label: t('Шалтгаангүй турах', 'Unexplained weight loss', 'Необъяснимая потеря веса'),
      redFlag: 'unexplained_weight_loss',
    },
    {
      value: 'swallow_stuck',
      label: t('Хоол залгихад гацах', 'Food feels stuck when swallowing', 'Пища застревает при глотании'),
      redFlag: 'unexplained_weight_loss',
    },
    {
      value: 'pregnancy_bleeding',
      label: t(
        'Жирэмсэн үед хэвлий өвдөх, цус гарах',
        'Abdominal pain or bleeding while pregnant',
        'Боль в животе или кровотечение при беременности',
      ),
      redFlag: 'pregnancy_abdominal_pain',
    },
  ]),

  // ── allergy, skin and itching ─────────────────────────────────────────
  warningSigns(
    'allergy_warning_signs',
    symptomIs('allergy', 'itching', 'skin_irritation'),
    [
      {
        value: 'airway',
        label: t(
          'Уруул, хэл, хоолой хавагнах, амьсгалахад хүндрэх',
          'Swelling of lips, tongue or throat, or trouble breathing',
          'Отёк губ, языка, горла или трудности с дыханием',
        ),
        redFlag: 'severe_allergic_reaction',
      },
      {
        value: 'spreading_fever',
        label: t(
          'Тууралт хурдан тархаж, халуурах',
          'A rash spreading quickly with a fever',
          'Быстро распространяющаяся сыпь с температурой',
        ),
        redFlag: 'stiff_neck_rash',
      },
      {
        value: 'blisters',
        label: t('Цэврүү, шархлаа', 'Blisters or open sores', 'Пузыри или открытые ранки'),
      },
      {
        value: 'eyes_mouth',
        label: t(
          'Нүд, ам, шээс бэлгийн замд тууралт',
          'A rash on the eyes, mouth or genitals',
          'Сыпь на глазах, во рту или на генитальной области',
        ),
        redFlag: 'severe_allergic_reaction',
      },
      { value: 'dizzy', label: t('Толгой эргэх, сульдах', 'Dizziness or feeling faint', 'Головокружение или слабость') },
    ],
  ),
  {
    key: 'allergy_trigger',
    step: 'SYMPTOM_DETAILS',
    type: 'text',
    max: 200,
    optional: true,
    when: symptomIs('allergy'),
    prompt: t(
      'Юунаас болсон гэж бодож байна вэ?',
      'What do you think triggered it?',
      'Что, по вашему мнению, вызвало это?',
    ),
  },

  // ── nose ──────────────────────────────────────────────────────────────
  warningSigns('nose_warning_signs', symptomIs('runny_nose', 'nasal_congestion'), [
    {
      value: 'facial_pain',
      label: t(
        'Дух, хамрын хажуугаар дарамттай өвдөх',
        'Pressure pain over the forehead or cheeks',
        'Давящая боль в области лба или щёк',
      ),
    },
    { value: 'fever', label: t('Халуурах', 'Fever', 'Температура') },
    {
      value: 'one_sided_bloody',
      label: t(
        'Нэг талаас цустай шүүрэл гарах',
        'Bloody discharge from one side only',
        'Кровянистые выделения только с одной стороны',
      ),
      redFlag: 'severe_bleeding',
    },
  ]),

  // ── musculoskeletal ───────────────────────────────────────────────────
  warningSigns('msk_warning_signs', symptomIs('muscle_pain', 'joint_pain', 'back_pain'), [
    {
      value: 'injury',
      label: t('Гэмтэл, бэртлийн дараа эхэлсэн', 'It started after an injury', 'Началось после травмы'),
    },
    {
      value: 'hot_swollen',
      label: t(
        'Үе хавдаж, халуу дүүгэх',
        'The joint is swollen and hot',
        'Сустав опухший и горячий',
      ),
    },
    {
      value: 'cannot_move',
      label: t('Хөдөлгөөн бүрэн хязгаарлагдсан', 'Cannot move it at all', 'Совсем не могу двигать'),
      redFlag: 'serious_injury',
    },
    {
      value: 'leg_weakness',
      label: t(
        'Хөл сульдах, мэдээ алдах',
        'Weakness or numbness in a leg',
        'Слабость или онемение в ноге',
      ),
      redFlag: 'sudden_weakness',
    },
    {
      value: 'bladder',
      label: t(
        'Шээс, өтгөн барих чадвар алдагдах',
        'Loss of bladder or bowel control',
        'Потеря контроля над мочеиспусканием или стулом',
      ),
      redFlag: 'sudden_weakness',
    },
    { value: 'fever', label: t('Халуурах', 'Fever', 'Температура') },
  ]),

  // ── eye ───────────────────────────────────────────────────────────────
  warningSigns('eye_warning_signs', symptomIs('eye'), [
    {
      value: 'vision_loss',
      label: t('Харах чадвар мууджээ', 'Reduced vision', 'Снижение зрения'),
      redFlag: 'eye_injury',
    },
    {
      value: 'severe_pain',
      label: t('Нүд хүчтэй өвдөх', 'Severe eye pain', 'Сильная боль в глазу'),
      redFlag: 'eye_injury',
    },
    {
      value: 'chemical',
      label: t(
        'Хими, гадны бодис оров',
        'A chemical or foreign body got in',
        'Попало химическое вещество или предмет',
      ),
      redFlag: 'eye_injury',
    },
    { value: 'contact_lens', label: t('Контакт линз хэрэглэдэг', 'I wear contact lenses', 'Ношу контактные линзы') },
    { value: 'discharge', label: t('Шүүрэл, ноож гарах', 'Discharge from the eye', 'Выделения из глаза') },
  ]),

  // ── ear ───────────────────────────────────────────────────────────────
  warningSigns('ear_warning_signs', symptomIs('ear'), [
    { value: 'discharge', label: t('Чихнээс шүүрэл гарах', 'Discharge from the ear', 'Выделения из уха') },
    { value: 'hearing_loss', label: t('Сонсгол мууджээ', 'Reduced hearing', 'Снижение слуха') },
    { value: 'fever', label: t('Халуурах', 'Fever', 'Температура') },
    {
      value: 'swelling_behind',
      label: t(
        'Чихний хойно хавдаж, өвдөх',
        'Swelling and pain behind the ear',
        'Отёк и боль за ухом',
      ),
      redFlag: 'serious_injury',
    },
    { value: 'dizzy', label: t('Толгой эргэх', 'Dizziness', 'Головокружение') },
  ]),

  // ── urinary ───────────────────────────────────────────────────────────
  warningSigns('urinary_warning_signs', symptomIs('urinary'), [
    { value: 'burning', label: t('Шээхэд хорсох, өвдөх', 'Burning or pain when passing urine', 'Жжение или боль при мочеиспускании') },
    {
      value: 'blood',
      label: t('Шээсэнд цус холилдох', 'Blood in the urine', 'Кровь в моче'),
      redFlag: 'blood_in_urine',
    },
    {
      value: 'flank_fever',
      label: t(
        'Бөөрний хавь өвдөж, халуурч, чичрэх',
        'Flank pain with fever or shivering',
        'Боль в боку с температурой или ознобом',
      ),
      redFlag: 'high_fever_persistent',
    },
    {
      value: 'no_urine',
      label: t('Шээс гарахгүй болсон', 'Unable to pass urine', 'Не могу помочиться'),
      redFlag: 'severe_abdominal_pain',
    },
  ]),

  // ── menstrual ─────────────────────────────────────────────────────────
  warningSigns('menstrual_warning_signs', symptomIs('menstrual'), [
    {
      value: 'heavy',
      label: t(
        'Цус алдалт их (1 цагт нэг хэрэгсэл дүүрэх)',
        'Very heavy bleeding (soaking a pad every hour)',
        'Очень сильное кровотечение (прокладка за час)',
      ),
      redFlag: 'severe_bleeding',
    },
    {
      value: 'faint',
      label: t('Толгой эргэх, ухаан балартах', 'Feeling faint or dizzy', 'Предобморочное состояние'),
      redFlag: 'severe_bleeding',
    },
    {
      value: 'pregnancy_possible',
      label: t('Жирэмсэн байх магадлалтай', 'Pregnancy is possible', 'Возможна беременность'),
    },
    { value: 'fever', label: t('Халуурах', 'Fever', 'Температура') },
  ]),

  // ── sleep ─────────────────────────────────────────────────────────────
  warningSigns('sleep_warning_signs', symptomIs('sleep'), [
    {
      value: 'breathing_pauses',
      label: t(
        'Унтаж байхад амьсгал тасалддаг гэж хэлсэн',
        'Someone has said my breathing stops while I sleep',
        'Мне говорили, что дыхание останавливается во сне',
      ),
    },
    {
      value: 'low_mood',
      label: t('Сэтгэл гутрал, түгшүүр', 'Low mood or anxiety', 'Подавленность или тревога'),
    },
    {
      value: 'self_harm',
      label: t(
        'Өөртөө хор хүргэх санаа',
        'Thoughts of harming myself',
        'Мысли о причинении себе вреда',
      ),
      redFlag: 'suicidal_thoughts',
    },
    {
      value: 'stimulants',
      label: t('Кофе, энергийн ундаа их хэрэглэдэг', 'I use a lot of caffeine or energy drinks', 'Много кофеина или энергетиков'),
    },
  ]),
]

// ─────────────────── steps 4–6: history, allergies, meds ───────────────────

const HISTORY: QuestionDef[] = [
  {
    key: 'conditions',
    step: 'MEDICAL_HISTORY',
    type: 'multi',
    optional: true,
    prompt: t(
      'Танд эмчийн онош тавьсан архаг өвчин байдаг уу?',
      'Do you have any diagnosed chronic conditions?',
      'Есть ли у вас диагностированные хронические заболевания?',
    ),
    help: t(
      'Байхгүй бол шууд дараагийн асуулт руу үргэлжлүүлээрэй.',
      'Continue without selecting anything if none apply.',
      'Продолжите без выбора, если ничего не подходит.',
    ),
    options: CONDITIONS.map((c) => ({ value: c.code, label: c.label })),
  },
  {
    key: 'condition_detail',
    step: 'MEDICAL_HISTORY',
    type: 'text',
    max: 300,
    optional: true,
    when: (s) => s.conditions.includes('other_chronic'),
    prompt: t('Бусад архаг өвчнөө бичнэ үү', 'Please describe the other condition', 'Опишите другое заболевание'),
  },
]

const ALLERGIES: QuestionDef[] = [
  {
    key: 'allergy_declared',
    step: 'ALLERGIES',
    type: 'single',
    prompt: t(
      'Танд ямар нэгэн эмийн харшил байдаг уу?',
      'Do you have any medicine allergies?',
      'Есть ли у вас аллергия на лекарства?',
    ),
    options: [
      { value: 'yes', label: YES },
      { value: 'no', label: NO },
      { value: 'unknown', label: t('Мэдэхгүй', "Don't know", 'Не знаю') },
    ],
  },
  {
    key: 'allergy_list',
    step: 'ALLERGIES',
    type: 'allergies',
    when: (s) => s.allergyDeclared === 'yes',
    prompt: t(
      'Ямар эмэнд харшилтай, ямар хариу урвал гарсныг бичнэ үү',
      'Which medicine, and what reaction did it cause?',
      'На какое лекарство и какая была реакция?',
    ),
    help: t(
      'Жишээ: амоксициллин — тууралт.',
      'For example: amoxicillin — rash.',
      'Например: амоксициллин — сыпь.',
    ),
  },
]

const MEDICATIONS: QuestionDef[] = [
  {
    key: 'current_medications',
    step: 'MEDICATIONS',
    type: 'medications',
    optional: true,
    prompt: t(
      'Одоогоор ямар эм, витамин эсвэл нэмэлт бүтээгдэхүүн хэрэглэж байна вэ?',
      'What medicines, vitamins or supplements are you currently taking?',
      'Какие лекарства, витамины или добавки вы принимаете сейчас?',
    ),
    help: t(
      'Нэрийг хайж сонгох, гараар бичих, зураг хуулах эсвэл баркод уншуулах боломжтой. Хэрэглэдэггүй бол хоосон орхиноо.',
      'Search the catalogue, type it in, upload a photo of the package, or scan a barcode. Leave empty if none.',
      'Найдите в каталоге, введите вручную, загрузите фото упаковки или отсканируйте штрихкод. Оставьте пустым, если ничего.',
    ),
  },
]

const SCREENING: QuestionDef[] = [
  {
    key: 'red_flag_checklist',
    step: 'RED_FLAG_SCREENING',
    type: 'multi',
    optional: true,
    isRedFlagProbe: true,
    prompt: t(
      'Доорхоос ямар нэг шинж тэмдэг байвал сонгоно уу',
      'Select any of the following that apply',
      'Отметьте всё, что относится к вам',
    ),
    help: t(
      'Эдгээр нь яаралтай эмнэлгийн үнэлгээ шаардаж болох шинж тэмдгүүд. Аль нь ч байхгүй бол шууд үргэлжлүүлээрэй.',
      'These may need urgent medical assessment. Continue without selecting anything if none apply.',
      'Это может требовать срочной медицинской оценки. Продолжите, если ничего не подходит.',
    ),
    options: CHECKLIST_RED_FLAGS.map((f) => ({ value: f.code, label: f.label, redFlag: f.code })),
  },
]

export const ALL_QUESTIONS: QuestionDef[] = [
  ...BASICS,
  ...COMPLAINT,
  ...DETAILS_COMMON,
  ...DETAILS_BY_SYMPTOM,
  ...HISTORY,
  ...ALLERGIES,
  ...MEDICATIONS,
  ...SCREENING,
]

const QUESTION_BY_KEY = new Map(ALL_QUESTIONS.map((q) => [q.key, q]))

export function questionByKey(key: string): QuestionDef | undefined {
  return QUESTION_BY_KEY.get(key)
}

// ───────────────────────────── flow control ────────────────────────────────

/**
 * True when an emergency-severity red flag has fired. The questionnaire stops
 * here: the customer is told to seek care instead of answering more questions.
 */
export function hasEmergencyFlag(state: AnswerState): boolean {
  return state.redFlagCodes.some((code) => RED_FLAG_BY_CODE.get(code)?.severity === 'EMERGENCY')
}

function applies(question: QuestionDef, state: AnswerState): boolean {
  return question.when ? question.when(state) : true
}

/** Every question that applies given the answers so far, in canonical order. */
export function applicableQuestions(state: AnswerState): QuestionDef[] {
  return ALL_QUESTIONS.filter((q) => applies(q, state))
}

export function nextQuestion(state: AnswerState): QuestionDef | null {
  if (hasEmergencyFlag(state)) return null
  for (const question of ALL_QUESTIONS) {
    if (!applies(question, state)) continue
    if (question.key in state.answers) continue
    return question
  }
  return null
}

export function progressPercent(state: AnswerState): number {
  const applicable = applicableQuestions(state)
  if (applicable.length === 0) return 100
  const answered = applicable.filter((q) => q.key in state.answers).length
  return Math.min(99, Math.round((answered / applicable.length) * 100))
}

export function toWireQuestion(
  question: QuestionDef,
  state: AnswerState,
  locale: string,
): WireQuestion {
  return {
    key: question.key,
    step: question.step,
    type: question.type,
    prompt: tr(question.prompt, locale),
    help: question.help ? tr(question.help, locale) : null,
    optional: Boolean(question.optional),
    isRedFlagProbe: Boolean(question.isRedFlagProbe),
    min: question.min ?? null,
    max: question.max ?? null,
    options: (question.options ?? []).map((o) => ({
      value: o.value,
      label: tr(o.label, locale),
      hint: o.hint ? tr(o.hint, locale) : null,
    })),
    progress: progressPercent(state),
  }
}

// ───────────────────────────── answer parsing ──────────────────────────────

export interface ParsedAnswer {
  value: unknown
  /** Human-readable rendering stored on the answer row for the audit trail. */
  label: string
  /** Red flag codes this answer raises. */
  redFlags: string[]
}

export class AnswerError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'AnswerError'
  }
}

export interface RawAllergy {
  medication: string
  reaction?: string | null
}

export interface RawMedication {
  name: string
  dose?: string | null
  frequency?: string | null
  source?: string | null
  productId?: string | null
  barcode?: string | null
  photoKey?: string | null
}

/**
 * Validates a submitted answer against the question that was actually asked.
 * An option value the question never offered is rejected — this is the only
 * gate between the browser and the safety engines, so it fails closed.
 */
export function parseAnswer(
  question: QuestionDef,
  raw: unknown,
  locale: string,
): ParsedAnswer {
  const optionOf = (value: string) => question.options?.find((o) => o.value === value)

  switch (question.type) {
    case 'single': {
      if (typeof raw !== 'string') throw new AnswerError('ANSWER_EXPECTED_STRING')
      const option = optionOf(raw)
      if (!option) throw new AnswerError('ANSWER_NOT_AN_OPTION')
      return {
        value: raw,
        label: tr(option.label, locale),
        redFlags: option.redFlag ? [option.redFlag] : [],
      }
    }

    case 'multi': {
      if (!Array.isArray(raw)) throw new AnswerError('ANSWER_EXPECTED_ARRAY')
      const values = raw.filter((v): v is string => typeof v === 'string')
      if (values.length > 40) throw new AnswerError('ANSWER_TOO_MANY')
      const options = values.map((value) => {
        const option = optionOf(value)
        if (!option) throw new AnswerError('ANSWER_NOT_AN_OPTION')
        return option
      })
      return {
        value: values,
        label: options.map((o) => tr(o.label, locale)).join(', ') || '—',
        redFlags: options.flatMap((o) => (o.redFlag ? [o.redFlag] : [])),
      }
    }

    case 'scale':
    case 'number': {
      const numeric = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(numeric)) {
        if (question.optional && (raw === '' || raw === null || raw === undefined)) {
          return { value: null, label: '—', redFlags: [] }
        }
        throw new AnswerError('ANSWER_EXPECTED_NUMBER')
      }
      const min = question.min ?? 0
      const max = question.max ?? 1_000_000
      if (numeric < min || numeric > max) throw new AnswerError('ANSWER_OUT_OF_RANGE')
      const rounded = Math.round(numeric * 10) / 10
      return { value: rounded, label: String(rounded), redFlags: [] }
    }

    case 'text': {
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (!text) {
        if (!question.optional) throw new AnswerError('ANSWER_REQUIRED')
        return { value: null, label: '—', redFlags: [] }
      }
      const capped = text.slice(0, question.max ?? 600)
      return { value: capped, label: capped, redFlags: [] }
    }

    case 'boolean': {
      const value = raw === true || raw === 'true' || raw === 'yes'
      return { value, label: value ? tr(YES, locale) : tr(NO, locale), redFlags: [] }
    }

    case 'allergies': {
      if (!Array.isArray(raw)) throw new AnswerError('ANSWER_EXPECTED_ARRAY')
      const entries: RawAllergy[] = []
      for (const item of raw.slice(0, 20)) {
        if (typeof item !== 'object' || item === null) continue
        const record = item as Record<string, unknown>
        const medication = typeof record.medication === 'string' ? record.medication.trim() : ''
        if (!medication) continue
        entries.push({
          medication: medication.slice(0, 120),
          reaction:
            typeof record.reaction === 'string' && record.reaction.trim()
              ? record.reaction.trim().slice(0, 200)
              : null,
        })
      }
      if (entries.length === 0 && !question.optional) throw new AnswerError('ANSWER_REQUIRED')
      return {
        value: entries,
        label: entries.map((e) => (e.reaction ? `${e.medication} — ${e.reaction}` : e.medication)).join('; ') || '—',
        redFlags: [],
      }
    }

    case 'medications': {
      if (!Array.isArray(raw)) throw new AnswerError('ANSWER_EXPECTED_ARRAY')
      const entries: RawMedication[] = []
      for (const item of raw.slice(0, 25)) {
        if (typeof item !== 'object' || item === null) continue
        const record = item as Record<string, unknown>
        const name = typeof record.name === 'string' ? record.name.trim() : ''
        if (!name) continue
        const source = typeof record.source === 'string' ? record.source : 'MANUAL'
        entries.push({
          name: name.slice(0, 160),
          dose: typeof record.dose === 'string' && record.dose.trim() ? record.dose.trim().slice(0, 60) : null,
          frequency:
            typeof record.frequency === 'string' && record.frequency.trim()
              ? record.frequency.trim().slice(0, 60)
              : null,
          source: ['CATALOGUE_SEARCH', 'MANUAL', 'BARCODE', 'PHOTO'].includes(source) ? source : 'MANUAL',
          productId: typeof record.productId === 'string' ? record.productId.slice(0, 40) : null,
          barcode: typeof record.barcode === 'string' ? record.barcode.slice(0, 60) : null,
          photoKey: typeof record.photoKey === 'string' ? record.photoKey.slice(0, 300) : null,
        })
      }
      return {
        value: entries,
        label: entries.map((e) => [e.name, e.dose, e.frequency].filter(Boolean).join(' ')).join('; ') || '—',
        redFlags: [],
      }
    }

    default:
      throw new AnswerError('ANSWER_UNSUPPORTED')
  }
}
