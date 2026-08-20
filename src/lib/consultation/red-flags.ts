/**
 * `RedFlagAssessmentAgent` (§9).
 *
 * Three independent detectors feed one union:
 *
 *   RULE      — a structured answer selected an option carrying a red flag.
 *   FREE_TEXT — the customer's own words matched a screening pattern.
 *   LLM       — the model spotted something the patterns missed (`llm.ts`).
 *
 * The detectors can only ever *add* flags. Nothing in this file, and nothing
 * the model returns, can clear a flag another detector raised — only a
 * pharmacist can, during review. A false positive costs one unnecessary
 * referral; a false negative can cost a patient.
 *
 * The patterns are deliberately broad and cover Mongolian, English and Russian
 * because a customer may type in any of them regardless of the UI language.
 */

import { RED_FLAG_BY_CODE, type RedFlagSeverityKey } from './types'

export const RED_FLAG_RULES_VERSION = 'rf-2026.08.1'

export interface DetectedRedFlag {
  code: string
  severity: RedFlagSeverityKey
  source: 'RULE' | 'FREE_TEXT' | 'LLM' | 'PHARMACIST'
  evidence: string | null
}

interface TextPattern {
  code: string
  pattern: RegExp
}

/**
 * Free-text screening patterns. Each maps to a catalogue red flag code so the
 * downstream severity and wording stay consistent with the checklist answers.
 */
const TEXT_PATTERNS: TextPattern[] = [
  {
    code: 'breathing_difficulty',
    pattern:
      /(амьсгал\s*давчд|амьсгалахад\s*(хүнд|хэцүү|бэрх)|амьсгал\s*(боог|тагл|дав)|хоолой\s*хаа|can'?t\s*breathe|cannot\s*breathe|short(ness)?\s*of\s*breath|struggling\s*to\s*breathe|gasping|не\s*могу\s*дышать|затрудн\w*\s*дыхан|одышк|нехватка\s*воздуха)/i,
  },
  {
    code: 'chest_pain',
    pattern:
      /(цээж(ээ)?\s*(хүчтэй\s*)?өвд|цээж\s*дарамт|зүрх\s*хүчтэй\s*өвд|chest\s*(pain|pressure|tightness)|crushing\s*chest|боль\s*в\s*груди|давит\s*в\s*груди|сжимает\s*грудь)/i,
  },
  {
    code: 'severe_allergic_reaction',
    pattern:
      /(хэл\s*хава|уруул\s*хава|хоолой\s*хава|анафилакс|бүх\s*бие\s*тууралт.*амьсгал|anaphyla|swollen\s*(tongue|lips|throat)|throat\s*closing|face\s*swelling|анафилакт|отёк\s*(языка|горла|губ)|отек\s*(языка|горла|губ))/i,
  },
  {
    code: 'loss_of_consciousness',
    pattern:
      /(ухаан\s*алд|мэдээ\s*алд|унаж\s*ухаан|fainted|passed\s*out|unconscious|loss\s*of\s*consciousness|black(ed)?\s*out|потер\w*\s*сознани|обморок)/i,
  },
  {
    code: 'seizure',
    pattern: /(таталт|тэвдэл|хөшиж\s*татал|seizure|convulsion|fitting|судорог|приступ\s*с\s*судорогами)/i,
  },
  {
    code: 'severe_confusion',
    pattern:
      /(ухаан\s*балар|ухаан\s*самуур|хэн\s*болохоо\s*мэдэх(гүй|гүйд)|delirium|very\s*confused|disorient|не\s*узнаёт|спутанн\w*\s*сознани|бред)/i,
  },
  {
    code: 'sudden_weakness',
    pattern:
      /(гэнэт\s*(гар|хөл|нэг\s*тал)\w*\s*(сульд|мэдээ\s*алд|хөдлөхгүй)|нэг\s*тал\s*мэдээгүй|тал\s*мэдээ\s*алд|sudden\s*(weakness|numbness)|one\s*side\s*(weak|numb)|can'?t\s*move\s*(my\s*)?(arm|leg)|внезапн\w*\s*слабост|онемени\w*\s*(руки|ноги|половин)|парализ)/i,
  },
  {
    code: 'speech_difficulty',
    pattern:
      /(хэл\s*(ор|тат|эргэлдэхгүй)|ярианд\s*хүнд|ярьж\s*чадахгүй|slurred\s*speech|can'?t\s*speak|trouble\s*speaking|наруш\w*\s*речи|не\s*может\s*говорить|невнятн\w*\s*речь)/i,
  },
  {
    code: 'sudden_severe_headache',
    pattern:
      /(гэнэт\s*.{0,20}толгой\s*.{0,12}(хүчтэй|тэсэхийн\s*аргагүй)|толгой\s*.{0,12}(тэсэхийн\s*аргагүй|хагарах)|аминдаа\s*үзээгүй\s*толгой|worst\s*headache\s*(of\s*my\s*life|ever)|thunderclap\s*headache|sudden\s*severe\s*headache|внезапн\w*\s*сильн\w*\s*головн\w*\s*бол|самая\s*сильная\s*головная\s*боль)/i,
  },
  {
    code: 'severe_bleeding',
    pattern:
      /(их\s*цус\s*ал|цус\s*тогтохгүй|цус\s*тогтоох\s*аргагүй|тасралтгүй\s*цус|heav(y|ily)\s*bleed|bleeding\s*(won'?t|doesn'?t)\s*stop|uncontrolled\s*bleeding|сильное\s*кровотечен|кровь\s*не\s*останавлив)/i,
  },
  {
    code: 'vomiting_blood',
    pattern:
      /(цус\s*бөөлж|бөөлжис.{0,12}цус|цустай\s*бөөлж|vomit(ing|ed)?\s*blood|blood\s*in\s*(my\s*)?vomit|coffee\s*ground\s*vomit|рвота\s*с\s*кровью|кровь\s*в\s*рвот)/i,
  },
  {
    code: 'black_stool',
    pattern:
      /(хар\s*өтгөн|давирхай\s*шиг\s*өтгөн|өтгөн\s*хар\w*\s*болс|black\s*(stool|stools)|tarry\s*stool|melena|чёрный\s*стул|черный\s*стул|дегтеобразн)/i,
  },
  {
    code: 'severe_dehydration',
    pattern:
      /(шээс\s*гарахгүй|шээсээ\s*хийхгүй|хэл\s*хуурайш.{0,20}(ухаан|сульд)|хүчтэй\s*шүүс\s*дутаг|severe(ly)?\s*dehydrat|no\s*urine|not\s*urinat|sunken\s*eyes|сильное\s*обезвожив|нет\s*мочи|не\s*мочится)/i,
  },
  {
    code: 'severe_abdominal_pain',
    pattern:
      /(хэвлий\s*.{0,15}(тэсэхийн\s*аргагүй|хүчтэй\s*өвд|хөшиж)|хэвлийд\s*хүрэхэд\s*өвд|severe\s*abdominal\s*pain|rigid\s*abdomen|unbearable\s*(stomach|abdominal)\s*pain|острая\s*боль\s*в\s*животе|живот\s*как\s*доска)/i,
  },
  {
    code: 'serious_injury',
    pattern:
      /(хүнд\s*гэмтэл|унаж\s*гэмт|ясаа\s*хугал|осолд\s*ор|машинд\s*дайруул|broken\s*bone|fracture|serious\s*injury|car\s*accident|перелом|серьёзн\w*\s*травм|попал\s*в\s*аварию)/i,
  },
  {
    code: 'suspected_poisoning',
    pattern:
      /(хордс|хордлого|хорт\s*бодис\s*(уу|залг)|цайруулагч\s*уу|poison(ed|ing)?|swallowed\s*(bleach|chemical)|ingested\s*chemical|отравлен|проглотил\s*(химич|бытов))/i,
  },
  {
    code: 'overdose',
    pattern:
      /(эм\s*хэтрүүл|хэт\s*их\s*эм\s*уу|тун\s*хэтрүүл|бүх\s*шахмалаа\s*уу|overdose|took\s*too\s*many\s*(pills|tablets)|took\s*the\s*whole\s*(pack|bottle)|передозиров|выпил\s*много\s*таблеток)/i,
  },
  {
    code: 'suicidal_thoughts',
    pattern:
      /(амиа\s*хорло|өөрийгөө\s*ал|үхмээр\s*байна|яахав\s*үхье|suicid|kill\s*myself|end\s*my\s*life|want\s*to\s*die|самоубийств|покончить\s*с\s*собой|хочу\s*умереть)/i,
  },
  {
    code: 'stiff_neck_rash',
    pattern:
      /(хүзүү\s*хөш.{0,25}(халуу|тууралт)|халуу.{0,25}хүзүү\s*хөш|stiff\s*neck.{0,25}(fever|rash)|meningit|скованност\w*\s*шеи|менингит)/i,
  },
  {
    code: 'blood_in_sputum',
    pattern:
      /(цэр.{0,12}цус|цустай\s*цэр|цус\s*хөх|blood\s*in\s*(my\s*)?(mucus|sputum|phlegm)|cough(ing)?\s*(up\s*)?blood|haemoptysis|hemoptysis|кровь\s*в\s*мокрот|кашель\s*с\s*кровью)/i,
  },
  {
    code: 'blood_in_urine',
    pattern:
      /(шээс.{0,12}цус|цустай\s*шээс|blood\s*in\s*(my\s*)?urine|haematuria|hematuria|кровь\s*в\s*моче)/i,
  },
  {
    code: 'blood_in_stool',
    pattern:
      /(өтгөн.{0,12}цус|цустай\s*өтгөн|blood\s*in\s*(my\s*)?stool|rectal\s*bleeding|кровь\s*в\s*стуле|кровь\s*из\s*заднего)/i,
  },
  {
    code: 'vision_change',
    pattern:
      /(хараа\s*(муудс|бүрэлз|давхарл)|нэг\s*нүд\s*харахгүй|харалган\s*бол|vision\s*(loss|blurred|double)|can'?t\s*see|lost\s*(my\s*)?sight|потер\w*\s*зрени|двоится\s*в\s*глазах|размыто\s*вижу)/i,
  },
  {
    code: 'infant_severe',
    pattern:
      /(нэг\s*нас\s*хүрээгүй.{0,30}(халуу|бөөлж|сульд)|нярай.{0,25}(халуу|сульд|бөөлж)|(infant|newborn|baby\s*under\s*(3|three)\s*months).{0,30}(fever|lethargic|not\s*feeding)|младенец.{0,25}(температур|вял))/i,
  },
]

/** Screens free text. Returns every pattern that matched, with its evidence. */
export function screenFreeText(text: string | null | undefined): DetectedRedFlag[] {
  if (!text) return []
  const found: DetectedRedFlag[] = []
  for (const rule of TEXT_PATTERNS) {
    const match = rule.pattern.exec(text)
    if (!match) continue
    const definition = RED_FLAG_BY_CODE.get(rule.code)
    if (!definition) continue
    found.push({
      code: rule.code,
      severity: definition.severity,
      source: 'FREE_TEXT',
      evidence: match[0].slice(0, 160),
    })
  }
  return found
}

/** Turns red flag codes raised by structured answers into detections. */
export function fromRuleCodes(codes: string[], evidence?: string | null): DetectedRedFlag[] {
  const out: DetectedRedFlag[] = []
  for (const code of codes) {
    const definition = RED_FLAG_BY_CODE.get(code)
    if (!definition) continue
    out.push({
      code,
      severity: definition.severity,
      source: 'RULE',
      evidence: evidence?.slice(0, 160) ?? null,
    })
  }
  return out
}

/**
 * Age-based screening that no question can express: a fever in an infant is a
 * red flag on its own, whatever else was answered.
 */
export function screenAge(input: {
  ageBand: string | null
  exactAgeYears: number | null
  primarySymptom: string | null
  secondarySymptoms: string[]
  severity: number | null
}): DetectedRedFlag[] {
  const out: DetectedRedFlag[] = []
  const symptoms = [input.primarySymptom, ...input.secondarySymptoms].filter(Boolean) as string[]
  const isInfant =
    input.ageBand === 'UNDER_2' && (input.exactAgeYears === null || input.exactAgeYears < 1)

  const alarmingForInfant = ['fever', 'vomiting', 'diarrhea', 'cough'].some((code) =>
    symptoms.includes(code),
  )

  if (isInfant && alarmingForInfant) {
    out.push({
      code: 'infant_severe',
      severity: 'EMERGENCY',
      source: 'RULE',
      evidence: 'infant with fever, vomiting, diarrhoea or cough',
    })
  }
  return out
}

/**
 * Merges detections from every source, keeping the first evidence seen and the
 * most severe classification for each code.
 */
export function mergeRedFlags(...groups: DetectedRedFlag[][]): DetectedRedFlag[] {
  const merged = new Map<string, DetectedRedFlag>()
  for (const group of groups) {
    for (const flag of group) {
      const existing = merged.get(flag.code)
      if (!existing) {
        merged.set(flag.code, flag)
        continue
      }
      // EMERGENCY always wins over URGENT; keep whichever evidence we have.
      merged.set(flag.code, {
        ...existing,
        severity: existing.severity === 'EMERGENCY' || flag.severity === 'EMERGENCY' ? 'EMERGENCY' : 'URGENT',
        evidence: existing.evidence ?? flag.evidence,
      })
    }
  }
  return [...merged.values()].sort((a, b) =>
    a.severity === b.severity ? a.code.localeCompare(b.code) : a.severity === 'EMERGENCY' ? -1 : 1,
  )
}

export function hasEmergency(flags: DetectedRedFlag[]): boolean {
  return flags.some((f) => f.severity === 'EMERGENCY')
}

export function hasUrgent(flags: DetectedRedFlag[]): boolean {
  return flags.some((f) => f.severity === 'URGENT')
}
