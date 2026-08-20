/**
 * Verified knowledge base for the AI consultation agent (§24).
 *
 * Everything the agent is allowed to say about a medicine originates here:
 *
 *   KnowledgeSource      — the provenance record (insert, protocol, database)
 *   ActiveIngredient     — canonical ingredient plus the brand names customers
 *                          actually type, so an entry can be resolved
 *   ProductIngredient    — what each catalogue product really contains
 *   OtcGuideline         — the only thing that permits an OTC suggestion
 *   ContraindicationRule — who must not be offered an ingredient
 *   InteractionRule      — verified pairwise verdicts
 *
 * This is demo-grade content modelled on standard OTC self-care practice. It is
 * structured exactly as production data would be — every clinical row carries a
 * source and an approving pharmacist — but before go-live the pharmacy's own
 * licensed pharmacist must review and re-approve every row here, and the
 * `version` / `approvedAt` fields exist so that review is recorded.
 */
import { prisma, daysAgo } from './seed-core'

// ───────────────────────────── knowledge sources ───────────────────────────

interface SourceSeed {
  key: string
  sourceType: 'PACKAGE_INSERT' | 'PRODUCT_INFORMATION' | 'PHARMACY_PROTOCOL' | 'DRUG_INTERACTION_DB' | 'CATALOGUE' | 'FAQ'
  title: string
  reference: string
  version: string
  body?: string
}

const SOURCES: SourceSeed[] = [
  {
    key: 'protocol-otc-selfcare',
    sourceType: 'PHARMACY_PROTOCOL',
    title: 'Иликон — Жоргүй эмийн өөрөө тусламжийн дотоод протокол',
    reference: 'ILK-PROT-OTC-01',
    version: '2026.08',
    body:
      'Эмийн сангийн эм зүйчийн батласан өөрөө тусламжийн зөвлөмж. Зовиур бүрээр ямар ангилал, ямар үйлчлэгч бодис санал болгож болохыг, хэдэн хоногийн дараа эмчид хандахыг тодорхойлно.',
  },
  {
    key: 'interaction-db-2026',
    sourceType: 'DRUG_INTERACTION_DB',
    title: 'Иликон — Эмийн харилцан үйлчлэлийн баталгаажсан сан',
    reference: 'ILK-IX-DB',
    version: '2026.08',
    body: 'Эм зүйчийн хянасан хос эмийн харилцан үйлчлэлийн дүгнэлт.',
  },
  {
    key: 'insert-paracetamol',
    sourceType: 'PACKAGE_INSERT',
    title: 'Парацетамол 500 мг — хайрцаган дахь заавар',
    reference: 'INS-PAR-500',
    version: '2025.11',
  },
  {
    key: 'insert-ibuprofen',
    sourceType: 'PACKAGE_INSERT',
    title: 'Ибупрофен 400 мг — хайрцаган дахь заавар',
    reference: 'INS-IBU-400',
    version: '2025.11',
  },
  {
    key: 'insert-antihistamine',
    sourceType: 'PACKAGE_INSERT',
    title: 'Лоратадин / Цетиризин — хайрцаган дахь заавар',
    reference: 'INS-AH-2G',
    version: '2026.02',
  },
  {
    key: 'insert-cough',
    sourceType: 'PACKAGE_INSERT',
    title: 'Гуайфенезин, ментол — хайрцаган дахь заавар',
    reference: 'INS-COUGH-01',
    version: '2025.09',
  },
  {
    key: 'insert-gi',
    sourceType: 'PACKAGE_INSERT',
    title: 'Диосмектит, ORS — хайрцаган дахь заавар',
    reference: 'INS-GI-01',
    version: '2026.01',
  },
  {
    key: 'insert-supplements',
    sourceType: 'PACKAGE_INSERT',
    title: 'Витамин, магни, цайр — бүтээгдэхүүний мэдээлэл',
    reference: 'INS-SUPP-01',
    version: '2026.03',
  },
  {
    key: 'insert-topical',
    sourceType: 'PRODUCT_INFORMATION',
    title: 'Арьс арчилгааны бүтээгдэхүүний мэдээлэл',
    reference: 'INS-TOP-01',
    version: '2026.04',
  },
]

// ──────────────────────────── active ingredients ───────────────────────────

interface IngredientSeed {
  key: string
  name: string
  nameMn: string
  nameRu: string
  className?: string
  classKey?: string
  isOtc: boolean
  aliases: string[]
}

const INGREDIENTS: IngredientSeed[] = [
  {
    key: 'paracetamol',
    name: 'Paracetamol',
    nameMn: 'Парацетамол',
    nameRu: 'Парацетамол',
    className: 'Analgesic / antipyretic',
    classKey: 'analgesic_antipyretic',
    isOtc: true,
    aliases: ['acetaminophen', 'ацетаминофен', 'панадол', 'panadol', 'эффералган', 'efferalgan', 'тайленол', 'tylenol', 'калпол', 'calpol', 'парацет'],
  },
  {
    key: 'ibuprofen',
    name: 'Ibuprofen',
    nameMn: 'Ибупрофен',
    nameRu: 'Ибупрофен',
    className: 'NSAID',
    classKey: 'nsaid',
    isOtc: true,
    aliases: ['нурофен', 'nurofen', 'advil', 'адвил', 'бруфен', 'brufen', 'ибуфен', 'ibufen', 'ибупром'],
  },
  {
    key: 'acetylsalicylic_acid',
    name: 'Acetylsalicylic acid',
    nameMn: 'Ацетилсалицилын хүчил',
    nameRu: 'Ацетилсалициловая кислота',
    className: 'NSAID / salicylate',
    classKey: 'nsaid',
    isOtc: false,
    aliases: ['aspirin', 'аспирин', 'аспирин кардио', 'aspirin cardio', 'асс', 'thromboass', 'тромбоасс'],
  },
  {
    key: 'naproxen',
    name: 'Naproxen',
    nameMn: 'Напроксен',
    nameRu: 'Напроксен',
    className: 'NSAID',
    classKey: 'nsaid',
    isOtc: false,
    aliases: ['налгезин', 'nalgesin', 'naproxen'],
  },
  {
    key: 'diclofenac',
    name: 'Diclofenac',
    nameMn: 'Диклофенак',
    nameRu: 'Диклофенак',
    className: 'NSAID',
    classKey: 'nsaid',
    isOtc: false,
    aliases: ['вольтарен', 'voltaren', 'diclofenac', 'диклак'],
  },
  {
    key: 'loratadine',
    name: 'Loratadine',
    nameMn: 'Лоратадин',
    nameRu: 'Лоратадин',
    className: 'Second-generation antihistamine',
    classKey: 'antihistamine_2g',
    isOtc: true,
    aliases: ['кларитин', 'claritin', 'лорано', 'lorano'],
  },
  {
    key: 'cetirizine',
    name: 'Cetirizine',
    nameMn: 'Цетиризин',
    nameRu: 'Цетиризин',
    className: 'Second-generation antihistamine',
    classKey: 'antihistamine_2g',
    isOtc: true,
    aliases: ['зиртек', 'zyrtec', 'аллертек', 'цетрин', 'cetrine', 'зодак', 'zodac'],
  },
  {
    key: 'guaifenesin',
    name: 'Guaifenesin',
    nameMn: 'Гуайфенезин',
    nameRu: 'Гвайфенезин',
    className: 'Expectorant',
    classKey: 'expectorant',
    isOtc: true,
    aliases: ['гвайфенезин', 'туссин', 'tussin'],
  },
  {
    key: 'menthol',
    name: 'Menthol',
    nameMn: 'Ментол',
    nameRu: 'Ментол',
    className: 'Topical / soothing agent',
    classKey: 'soothing',
    isOtc: true,
    aliases: ['ментол'],
  },
  {
    key: 'eucalyptus_oil',
    name: 'Eucalyptus oil',
    nameMn: 'Эвкалиптын тос',
    nameRu: 'Эвкалиптовое масло',
    className: 'Topical / soothing agent',
    classKey: 'soothing',
    isOtc: true,
    aliases: ['эвкалипт', 'eucalyptus'],
  },
  {
    key: 'diosmectite',
    name: 'Diosmectite',
    nameMn: 'Диосмектит',
    nameRu: 'Диосмектит',
    className: 'Intestinal adsorbent',
    classKey: 'adsorbent',
    isOtc: true,
    aliases: ['смекта', 'smecta', 'неосмектин'],
  },
  {
    key: 'oral_rehydration_salts',
    name: 'Oral rehydration salts',
    nameMn: 'Шингэн нөхөх сэлт (ORS)',
    nameRu: 'Соли для пероральной регидратации',
    className: 'Rehydration',
    classKey: 'rehydration',
    isOtc: true,
    aliases: ['ors', 'орс', 'регидрон', 'regidron', 'гидровит'],
  },
  {
    key: 'sodium_chloride_nasal',
    name: 'Sodium chloride (saline)',
    nameMn: 'Натрийн хлорид (далайн ус)',
    nameRu: 'Натрия хлорид (морская вода)',
    className: 'Nasal saline',
    classKey: 'saline',
    isOtc: true,
    aliases: ['аквамарис', 'aqua maris', 'аква марис', 'физраствор', 'далайн ус', 'sea water'],
  },
  {
    key: 'probiotic',
    name: 'Probiotic (lactobacillus)',
    nameMn: 'Пробиотик',
    nameRu: 'Пробиотик',
    className: 'Probiotic',
    classKey: 'probiotic',
    isOtc: true,
    aliases: ['лактобактерин', 'линекс', 'linex', 'бифидум'],
  },
  {
    key: 'ascorbic_acid',
    name: 'Ascorbic acid (vitamin C)',
    nameMn: 'Аскорбины хүчил (витамин C)',
    nameRu: 'Аскорбиновая кислота',
    className: 'Vitamin',
    classKey: 'vitamin',
    isOtc: true,
    aliases: ['витамин с', 'vitamin c', 'аскорбин'],
  },
  {
    key: 'cholecalciferol',
    name: 'Cholecalciferol (vitamin D3)',
    nameMn: 'Холекальциферол (D3)',
    nameRu: 'Холекальциферол (D3)',
    className: 'Vitamin',
    classKey: 'vitamin',
    isOtc: true,
    aliases: ['витамин d', 'витамин д', 'vitamin d', 'aquadetrim', 'аквадетрим'],
  },
  {
    key: 'multivitamin',
    name: 'Multivitamin complex',
    nameMn: 'Мультивитамин',
    nameRu: 'Мультивитамины',
    className: 'Vitamin',
    classKey: 'vitamin',
    isOtc: true,
    aliases: ['мультивитамин', 'multivitamin', 'центрум', 'centrum'],
  },
  {
    key: 'prenatal_vitamin',
    name: 'Prenatal vitamin complex',
    nameMn: 'Жирэмсний витамин',
    nameRu: 'Витамины для беременных',
    className: 'Vitamin',
    classKey: 'vitamin',
    isOtc: true,
    aliases: ['элевит', 'elevit', 'фемибион', 'прегнакеа'],
  },
  {
    key: 'zinc',
    name: 'Zinc',
    nameMn: 'Цайр',
    nameRu: 'Цинк',
    className: 'Mineral',
    classKey: 'mineral',
    isOtc: true,
    aliases: ['цинк', 'zinc'],
  },
  {
    key: 'magnesium',
    name: 'Magnesium with vitamin B6',
    nameMn: 'Магни B6',
    nameRu: 'Магний B6',
    className: 'Mineral',
    classKey: 'mineral',
    isOtc: true,
    aliases: ['магни', 'магний', 'magne b6', 'магне в6', 'magnesium'],
  },
  {
    key: 'omega3',
    name: 'Omega-3 fatty acids',
    nameMn: 'Омега-3',
    nameRu: 'Омега-3',
    className: 'Supplement',
    classKey: 'supplement',
    isOtc: true,
    aliases: ['омега 3', 'omega 3', 'рыбий жир', 'загасны тос'],
  },

  // ── prescription-only: stocked or commonly reported by customers ────────
  {
    key: 'omeprazole',
    name: 'Omeprazole',
    nameMn: 'Омепразол',
    nameRu: 'Омепразол',
    className: 'Proton pump inhibitor',
    classKey: 'ppi',
    isOtc: false,
    aliases: ['омез', 'omez', 'лосек', 'losec', 'омепразол'],
  },
  {
    key: 'amoxicillin',
    name: 'Amoxicillin',
    nameMn: 'Амоксициллин',
    nameRu: 'Амоксициллин',
    className: 'Penicillin antibiotic',
    classKey: 'penicillin',
    isOtc: false,
    aliases: ['амоксил', 'flemoxin', 'флемоксин', 'ospamox', 'оспамокс'],
  },
  {
    key: 'metformin',
    name: 'Metformin',
    nameMn: 'Метформин',
    nameRu: 'Метформин',
    className: 'Biguanide antidiabetic',
    classKey: 'antidiabetic',
    isOtc: false,
    aliases: ['глюкофаж', 'glucophage', 'сиофор', 'siofor', 'метфогамма'],
  },
  {
    key: 'salbutamol',
    name: 'Salbutamol',
    nameMn: 'Салбутамол',
    nameRu: 'Салбутамол',
    className: 'Short-acting beta agonist',
    classKey: 'saba',
    isOtc: false,
    aliases: ['вентолин', 'ventolin', 'albuterol', 'альбутерол', 'сальбутамол'],
  },
  {
    key: 'warfarin',
    name: 'Warfarin',
    nameMn: 'Варфарин',
    nameRu: 'Варфарин',
    className: 'Vitamin K antagonist anticoagulant',
    classKey: 'anticoagulant',
    isOtc: false,
    aliases: ['варфарекс', 'warfarex', 'кумадин', 'coumadin'],
  },
  {
    key: 'enalapril',
    name: 'Enalapril',
    nameMn: 'Эналаприл',
    nameRu: 'Эналаприл',
    className: 'ACE inhibitor',
    classKey: 'ace_inhibitor',
    isOtc: false,
    aliases: ['энап', 'enap', 'энам', 'renitec', 'ренитек'],
  },
  {
    key: 'amlodipine',
    name: 'Amlodipine',
    nameMn: 'Амлодипин',
    nameRu: 'Амлодипин',
    className: 'Calcium channel blocker',
    classKey: 'ccb',
    isOtc: false,
    aliases: ['норваск', 'norvasc', 'амлотоп'],
  },
  {
    key: 'levothyroxine',
    name: 'Levothyroxine',
    nameMn: 'Левотироксин',
    nameRu: 'Левотироксин',
    className: 'Thyroid hormone',
    classKey: 'thyroid_hormone',
    isOtc: false,
    aliases: ['эутирокс', 'euthyrox', 'l-тироксин', 'l-thyroxin'],
  },
]

// ───────────────────── catalogue product → ingredients ─────────────────────

const PRODUCT_INGREDIENTS: { sku: string; ingredients: { key: string; strengthLabel?: string; primary?: boolean }[] }[] = [
  { sku: 'ILK-PAR-500', ingredients: [{ key: 'paracetamol', strengthLabel: '500 мг' }] },
  { sku: 'ILK-IBU-400', ingredients: [{ key: 'ibuprofen', strengthLabel: '400 мг' }] },
  { sku: 'ILK-BABY-PARA', ingredients: [{ key: 'paracetamol', strengthLabel: '120 мг/5 мл' }] },
  { sku: 'ILK-AMO-500', ingredients: [{ key: 'amoxicillin', strengthLabel: '500 мг' }] },
  { sku: 'ILK-ASP-100', ingredients: [{ key: 'acetylsalicylic_acid', strengthLabel: '100 мг' }] },
  { sku: 'ILK-OMEP-20', ingredients: [{ key: 'omeprazole', strengthLabel: '20 мг' }] },
  { sku: 'ILK-METF-850', ingredients: [{ key: 'metformin', strengthLabel: '850 мг' }] },
  { sku: 'ILK-SALB-INH', ingredients: [{ key: 'salbutamol', strengthLabel: '100 мкг/доз' }] },
  { sku: 'ILK-LOR-10', ingredients: [{ key: 'loratadine', strengthLabel: '10 мг' }] },
  { sku: 'ILK-CETI-10', ingredients: [{ key: 'cetirizine', strengthLabel: '10 мг' }] },
  {
    sku: 'ILK-COLD-SYR',
    ingredients: [{ key: 'guaifenesin' }, { key: 'menthol', primary: false }],
  },
  {
    sku: 'ILK-THROAT-LOZ',
    ingredients: [{ key: 'menthol' }, { key: 'eucalyptus_oil', primary: false }],
  },
  { sku: 'ILK-NASAL-SPR', ingredients: [{ key: 'sodium_chloride_nasal' }] },
  { sku: 'ILK-SMECT', ingredients: [{ key: 'diosmectite', strengthLabel: '3 г' }] },
  { sku: 'ILK-ORS-SACH', ingredients: [{ key: 'oral_rehydration_salts' }] },
  { sku: 'ILK-PROBIO', ingredients: [{ key: 'probiotic' }] },
  { sku: 'ILK-VITC-1000', ingredients: [{ key: 'ascorbic_acid', strengthLabel: '1000 мг' }] },
  { sku: 'ILK-VITD-2000', ingredients: [{ key: 'cholecalciferol', strengthLabel: '2000 IU' }] },
  { sku: 'ILK-MULTI-50', ingredients: [{ key: 'multivitamin' }] },
  { sku: 'ILK-PRENATAL', ingredients: [{ key: 'prenatal_vitamin' }] },
  { sku: 'ILK-ZINC-25', ingredients: [{ key: 'zinc', strengthLabel: '25 мг' }] },
  { sku: 'ILK-MAGB6', ingredients: [{ key: 'magnesium' }] },
  { sku: 'ILK-OMEGA3', ingredients: [{ key: 'omega3' }] },
]

// ──────────────────────────── OTC guidelines (§24) ─────────────────────────

interface GuidelineSeed {
  key: string
  symptomCode: string
  title: string
  categorySlugs: string[]
  ingredientKeys: string[]
  minAgeYears?: number
  maxSelfCareDays: number
  rationaleMn: string
  rationaleEn: string
  rationaleRu: string
  precautionMn?: string
  precautionEn?: string
  precautionRu?: string
  pregnancyNeedsPharmacist?: boolean
  sourceKey: string
}

const GUIDELINES: GuidelineSeed[] = [
  {
    key: 'gl-headache',
    symptomCode: 'headache',
    title: 'Хөнгөн толгой өвдөлт — өөрөө тусламж',
    categorySlugs: ['uvdult-namdaah'],
    ingredientKeys: ['paracetamol', 'ibuprofen'],
    minAgeYears: 12,
    maxSelfCareDays: 3,
    rationaleMn: 'Хөнгөн, дунд зэргийн толгой өвдөлтийг түр зуур хөнгөвчлөхөд өвдөлт намдаах ангиллын бүтээгдэхүүн тохирч болно.',
    rationaleEn: 'A pain-relief product may give temporary relief of mild to moderate headache.',
    rationaleRu: 'Обезболивающее средство может временно облегчить слабую или умеренную головную боль.',
    precautionMn: 'Өвдөлт намдаах эмийг 3 хоногоос дээш дараалан хэрэглэвэл толгой өвдөлт дордох тохиолдол байдаг тул эмчид хандана уу.',
    precautionEn: 'Using pain relief for more than 3 days in a row can itself worsen headache — see a doctor instead.',
    precautionRu: 'Приём обезболивающих более 3 дней подряд может усилить головную боль — обратитесь к врачу.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-fever',
    symptomCode: 'fever',
    title: 'Халуурал — өөрөө тусламж',
    categorySlugs: ['uvdult-namdaah', 'huuhdiin-buteegdehuun'],
    ingredientKeys: ['paracetamol', 'ibuprofen'],
    minAgeYears: 2,
    maxSelfCareDays: 3,
    rationaleMn: 'Халуун буулгах, өвдөлт намдаах ангиллын бүтээгдэхүүн халуурлын шинжийг түр зуур хөнгөвчилж болно.',
    rationaleEn: 'An antipyretic pain-relief product may temporarily ease the symptoms of a fever.',
    rationaleRu: 'Жаропонижающее средство может временно облегчить симптомы повышенной температуры.',
    precautionMn: 'Шингэн хангалттай ууж, 3 хоногоос дээш халуурвал эмчид хандана уу.',
    precautionEn: 'Keep up fluid intake, and see a doctor if the fever lasts more than 3 days.',
    precautionRu: 'Пейте достаточно жидкости; при температуре более 3 дней обратитесь к врачу.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-cough',
    symptomCode: 'cough',
    title: 'Хөнгөн хөх — өөрөө тусламж',
    categorySlugs: ['haniad-tomuu'],
    ingredientKeys: ['guaifenesin', 'menthol', 'eucalyptus_oil'],
    minAgeYears: 6,
    maxSelfCareDays: 7,
    rationaleMn: 'Цэр хөөх, хоолой зөөлрүүлэх ангиллын бүтээгдэхүүн хөнгөн хөхийг хөнгөвчлөхөд тохирч болно.',
    rationaleEn: 'An expectorant or soothing product may help ease a mild cough.',
    rationaleRu: 'Отхаркивающее или смягчающее средство может облегчить лёгкий кашель.',
    precautionMn: '7 хоногоос дээш хөх үргэлжилбэл, эсвэл халуун, амьсгал давчдах шинж нэмэгдвэл эмчид хандана уу.',
    precautionEn: 'See a doctor if the cough lasts over 7 days, or if fever or breathlessness develops.',
    precautionRu: 'Обратитесь к врачу, если кашель длится более 7 дней или появились температура и одышка.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-sore-throat',
    symptomCode: 'sore_throat',
    title: 'Хоолой өвдөх — өөрөө тусламж',
    categorySlugs: ['haniad-tomuu', 'uvdult-namdaah'],
    ingredientKeys: ['menthol', 'eucalyptus_oil', 'paracetamol'],
    minAgeYears: 6,
    maxSelfCareDays: 5,
    rationaleMn: 'Хоолой зөөлрүүлэх шимэх шахмал болон өвдөлт намдаах бүтээгдэхүүн хоолойн зовиурыг хөнгөвчилж болно.',
    rationaleEn: 'Soothing lozenges and pain relief may ease throat discomfort.',
    rationaleRu: 'Смягчающие пастилки и обезболивающее могут облегчить боль в горле.',
    precautionMn: '5 хоногоос дээш үргэлжилбэл, эсвэл залгихад хүндрэл, өндөр халуун байвал эмчид хандана уу.',
    precautionEn: 'See a doctor if it lasts over 5 days, or with difficulty swallowing or a high fever.',
    precautionRu: 'При длительности более 5 дней, трудностях глотания или высокой температуре — к врачу.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-runny-nose',
    symptomCode: 'runny_nose',
    title: 'Хамар нусгайрах — өөрөө тусламж',
    categorySlugs: ['haniad-tomuu', 'harshil'],
    ingredientKeys: ['sodium_chloride_nasal', 'loratadine', 'cetirizine'],
    maxSelfCareDays: 10,
    rationaleMn: 'Далайн ус агуулсан хамрын шүршигч болон харшлын эсрэг ангиллын бүтээгдэхүүн хамрын зовиурыг хөнгөвчилж болно.',
    rationaleEn: 'A saline nasal spray or an antihistamine product may ease nasal symptoms.',
    rationaleRu: 'Солевой спрей для носа или антигистаминное средство могут облегчить симптомы.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-nasal-congestion',
    symptomCode: 'nasal_congestion',
    title: 'Хамар битүүрэх — өөрөө тусламж',
    categorySlugs: ['haniad-tomuu'],
    ingredientKeys: ['sodium_chloride_nasal'],
    maxSelfCareDays: 7,
    rationaleMn: 'Далайн ус агуулсан хамрын шүршигч хамрын битүүрлийг хөнгөвчлөхөд хэрэглэгддэг.',
    rationaleEn: 'A saline nasal spray is used to relieve nasal congestion.',
    rationaleRu: 'Солевой спрей для носа используется для облегчения заложенности.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-allergy',
    symptomCode: 'allergy',
    title: 'Харшлын хөнгөн шинж — өөрөө тусламж',
    categorySlugs: ['harshil'],
    ingredientKeys: ['loratadine', 'cetirizine'],
    minAgeYears: 2,
    maxSelfCareDays: 14,
    rationaleMn: 'Харшлын эсрэг (антихистамин) ангиллын бүтээгдэхүүн харшлын хөнгөн шинжийг хөнгөвчлөхөд тохирч болно.',
    rationaleEn: 'An antihistamine product may help with mild allergy symptoms.',
    rationaleRu: 'Антигистаминное средство может помочь при лёгких симптомах аллергии.',
    precautionMn: 'Хавагнах, амьсгалахад хүндрэх шинж илэрвэл энэ нь яаралтай тусламж шаардана.',
    precautionEn: 'Swelling or difficulty breathing needs emergency care, not self-care.',
    precautionRu: 'Отёк или затруднённое дыхание требуют экстренной помощи, а не самолечения.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-diarrhea',
    symptomCode: 'diarrhea',
    title: 'Хөнгөн суулгалт — өөрөө тусламж',
    categorySlugs: ['hool-bolovsruulah', 'anhny-tuslamts'],
    ingredientKeys: ['diosmectite', 'oral_rehydration_salts', 'probiotic'],
    minAgeYears: 2,
    maxSelfCareDays: 2,
    rationaleMn: 'Шингэн нөхөх сэлт нь суулгалтын үед шүүс дутагдахаас сэргийлэхэд гол ач холбогдолтой; гэдэсний адсорбент бүтээгдэхүүн зовиурыг хөнгөвчилж болно.',
    rationaleEn: 'Rehydration salts are the priority in diarrhoea; an intestinal adsorbent may ease symptoms.',
    rationaleRu: 'При диарее главное — соли для регидратации; адсорбент может облегчить симптомы.',
    precautionMn: 'Шүүс дутагдлын шинж, цустай өтгөн, 2 хоногоос дээш үргэлжлэх нь эмчийн үзлэг шаардана.',
    precautionEn: 'Signs of dehydration, blood in the stool, or more than 2 days need medical review.',
    precautionRu: 'Признаки обезвоживания, кровь в стуле или более 2 дней требуют осмотра врача.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-vomiting',
    symptomCode: 'vomiting',
    title: 'Бөөлжилт — шингэн нөхөх',
    categorySlugs: ['anhny-tuslamts'],
    ingredientKeys: ['oral_rehydration_salts'],
    minAgeYears: 2,
    maxSelfCareDays: 1,
    rationaleMn: 'Бөөлжилтийн үед шингэн, электролит нөхөх нь хамгийн чухал.',
    rationaleEn: 'Replacing fluid and electrolytes is the priority when vomiting.',
    rationaleRu: 'При рвоте главное — восполнение жидкости и электролитов.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-muscle-pain',
    symptomCode: 'muscle_pain',
    title: 'Булчингийн хөнгөн өвдөлт — өөрөө тусламж',
    categorySlugs: ['uvdult-namdaah'],
    ingredientKeys: ['paracetamol', 'ibuprofen'],
    minAgeYears: 12,
    maxSelfCareDays: 7,
    rationaleMn: 'Өвдөлт намдаах, үрэвслийн эсрэг ангиллын бүтээгдэхүүн булчингийн хөнгөн өвдөлтийг хөнгөвчилж болно.',
    rationaleEn: 'A pain-relief or anti-inflammatory product may ease mild muscle pain.',
    rationaleRu: 'Обезболивающее или противовоспалительное средство может облегчить лёгкую боль в мышцах.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-joint-pain',
    symptomCode: 'joint_pain',
    title: 'Үений хөнгөн өвдөлт — өөрөө тусламж',
    categorySlugs: ['uvdult-namdaah'],
    ingredientKeys: ['paracetamol', 'ibuprofen'],
    minAgeYears: 18,
    maxSelfCareDays: 5,
    rationaleMn: 'Өвдөлт намдаах ангиллын бүтээгдэхүүн үений хөнгөн зовиурыг түр хөнгөвчилж болно.',
    rationaleEn: 'A pain-relief product may temporarily ease mild joint discomfort.',
    rationaleRu: 'Обезболивающее может временно облегчить лёгкий дискомфорт в суставе.',
    precautionMn: 'Үе хавдаж, халуу дүүгэх, хөдөлгөөн хязгаарлагдах нь эмчийн үзлэг шаардана.',
    precautionEn: 'A swollen, hot or immobile joint needs medical review.',
    precautionRu: 'Опухший, горячий или неподвижный сустав требует осмотра врача.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-back-pain',
    symptomCode: 'back_pain',
    title: 'Нурууны хөнгөн өвдөлт — өөрөө тусламж',
    categorySlugs: ['uvdult-namdaah'],
    ingredientKeys: ['paracetamol', 'ibuprofen'],
    minAgeYears: 18,
    maxSelfCareDays: 7,
    rationaleMn: 'Өвдөлт намдаах ангиллын бүтээгдэхүүн нурууны хөнгөн өвдөлтийг хөнгөвчлөхөд тохирч болно.',
    rationaleEn: 'A pain-relief product may help with mild back pain.',
    rationaleRu: 'Обезболивающее может помочь при лёгкой боли в спине.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-menstrual',
    symptomCode: 'menstrual',
    title: 'Сарын тэмдгийн өвдөлт — өөрөө тусламж',
    categorySlugs: ['uvdult-namdaah'],
    ingredientKeys: ['ibuprofen', 'paracetamol'],
    minAgeYears: 12,
    maxSelfCareDays: 3,
    rationaleMn: 'Өвдөлт намдаах ангиллын бүтээгдэхүүн сарын тэмдгийн үеийн хөнгөн өвдөлтийг хөнгөвчилж болно.',
    rationaleEn: 'A pain-relief product may ease mild period pain.',
    rationaleRu: 'Обезболивающее может облегчить лёгкую менструальную боль.',
    sourceKey: 'protocol-otc-selfcare',
  },
  {
    key: 'gl-skin-irritation',
    symptomCode: 'skin_irritation',
    title: 'Арьсны хөнгөн цочрол — өөрөө тусламж',
    categorySlugs: ['aris-archilgaa'],
    ingredientKeys: [],
    maxSelfCareDays: 7,
    rationaleMn: 'Арьс зөөлрүүлэх, хамгаалах ангиллын бүтээгдэхүүн хуурайшилт, хөнгөн цочролыг хөнгөвчилж болно.',
    rationaleEn: 'An emollient or barrier product may ease dryness and mild irritation.',
    rationaleRu: 'Смягчающее или защитное средство может облегчить сухость и лёгкое раздражение.',
    precautionMn: 'Тууралт хурдан тархах, цэврүүтэх, халуурах нь эмчийн үзлэг шаардана.',
    precautionEn: 'A fast-spreading rash, blistering or fever needs medical review.',
    precautionRu: 'Быстро распространяющаяся сыпь, пузыри или температура требуют осмотра врача.',
    sourceKey: 'insert-topical',
  },
  {
    key: 'gl-itching',
    symptomCode: 'itching',
    title: 'Арьс тачигнах — өөрөө тусламж',
    categorySlugs: ['harshil', 'aris-archilgaa'],
    ingredientKeys: ['loratadine', 'cetirizine'],
    minAgeYears: 2,
    maxSelfCareDays: 7,
    rationaleMn: 'Харшлын эсрэг ангиллын бүтээгдэхүүн болон арьс зөөлрүүлэх тос тачигналтыг хөнгөвчилж болно.',
    rationaleEn: 'An antihistamine product and an emollient may reduce itching.',
    rationaleRu: 'Антигистаминное средство и смягчающий крем могут уменьшить зуд.',
    sourceKey: 'protocol-otc-selfcare',
  },
]

// ─────────────────────── contraindications (§16) ───────────────────────────

interface ContraSeed {
  ingredientKey: string
  scope: 'AGE' | 'PREGNANCY' | 'BREASTFEEDING' | 'CONDITION' | 'ALLERGY'
  severity: 'BLOCK' | 'PHARMACIST_REVIEW' | 'WARN'
  conditionCode?: string
  minAgeYears?: number
  maxAgeYears?: number
  mn: string
  en: string
  ru: string
  sourceKey: string
}

const CONTRA: ContraSeed[] = [
  // paracetamol
  {
    ingredientKey: 'paracetamol',
    scope: 'CONDITION',
    conditionCode: 'liver_disease',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Элэгний өвчинтэй хүнд парацетамолын тун хязгаарлагдана. Эм зүйчтэй зөвлөнө үү.',
    en: 'Paracetamol dosing is restricted in liver disease. Please consult a pharmacist.',
    ru: 'При болезни печени дозировка парацетамола ограничена. Обратитесь к фармацевту.',
    sourceKey: 'insert-paracetamol',
  },
  {
    ingredientKey: 'paracetamol',
    scope: 'PREGNANCY',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Жирэмсэн үед хэрэглэхээс өмнө эм зүйч, эмчтэй зөвлөнө үү.',
    en: 'Consult a pharmacist or doctor before use during pregnancy.',
    ru: 'Перед применением при беременности проконсультируйтесь с фармацевтом или врачом.',
    sourceKey: 'insert-paracetamol',
  },

  // ibuprofen
  {
    ingredientKey: 'ibuprofen',
    scope: 'CONDITION',
    conditionCode: 'ulcer',
    severity: 'BLOCK',
    mn: 'Ходоодны шархлаатай хүнд үрэвслийн эсрэг эм (NSAID) хэрэглэхийг хориглодог.',
    en: 'NSAIDs are contraindicated with a stomach ulcer.',
    ru: 'НПВП противопоказаны при язве желудка.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'CONDITION',
    conditionCode: 'bleeding_disorder',
    severity: 'BLOCK',
    mn: 'Цус тогтоох эмгэгтэй үед NSAID цус алдалтын эрсдэлийг нэмэгдүүлдэг.',
    en: 'NSAIDs increase bleeding risk in a bleeding disorder.',
    ru: 'НПВП повышают риск кровотечения при нарушении свёртываемости.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'CONDITION',
    conditionCode: 'kidney_disease',
    severity: 'BLOCK',
    mn: 'Бөөрний өвчинтэй хүнд NSAID бөөрний ажиллагааг дордуулж болно.',
    en: 'NSAIDs can worsen kidney function in kidney disease.',
    ru: 'НПВП могут ухудшить функцию почек при болезни почек.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'CONDITION',
    conditionCode: 'heart_disease',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Зүрхний өвчинтэй үед NSAID хэрэглэхийг эм зүйч хянах шаардлагатай.',
    en: 'NSAID use with heart disease must be reviewed by a pharmacist.',
    ru: 'Применение НПВП при болезни сердца должен проверить фармацевт.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'CONDITION',
    conditionCode: 'hypertension',
    severity: 'PHARMACIST_REVIEW',
    mn: 'NSAID цусны даралтыг ихэсгэж, даралт буулгах эмийн үйлчлэлийг сулруулж болно.',
    en: 'NSAIDs can raise blood pressure and blunt antihypertensive medicines.',
    ru: 'НПВП могут повышать давление и снижать действие гипотензивных средств.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'CONDITION',
    conditionCode: 'asthma',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Астматай хүний тодорхой хувьд NSAID амьсгалын шинжийг сэдрээдэг тул эм зүйч хянана.',
    en: 'NSAIDs trigger respiratory symptoms in some people with asthma — pharmacist review required.',
    ru: 'У части людей с астмой НПВП вызывают обострение — требуется проверка фармацевта.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'PREGNANCY',
    severity: 'BLOCK',
    mn: 'Жирэмсэн үед, ялангуяа гурав дахь гурван сард NSAID хэрэглэхийг хориглодог.',
    en: 'NSAIDs are contraindicated in pregnancy, particularly the third trimester.',
    ru: 'НПВП противопоказаны при беременности, особенно в третьем триместре.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'BREASTFEEDING',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Хөхүүл үед хэрэглэхээс өмнө эм зүйчтэй зөвлөнө үү.',
    en: 'Consult a pharmacist before use while breastfeeding.',
    ru: 'Перед применением при кормлении обратитесь к фармацевту.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'AGE',
    minAgeYears: 1,
    severity: 'BLOCK',
    mn: 'Нэг нас хүрээгүй хүүхдэд эмчийн зөвлөгөөгүйгээр хэрэглэхийг хориглодог.',
    en: 'Not for children under one year without a doctor’s advice.',
    ru: 'Не применять детям до одного года без назначения врача.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'ibuprofen',
    scope: 'ALLERGY',
    conditionCode: 'nsaid',
    severity: 'BLOCK',
    mn: 'Үрэвслийн эсрэг эмэнд (NSAID) харшилтай хүнд хэрэглэхгүй.',
    en: 'Not for anyone allergic to NSAIDs.',
    ru: 'Не применять при аллергии на НПВП.',
    sourceKey: 'insert-ibuprofen',
  },

  // acetylsalicylic acid
  {
    ingredientKey: 'acetylsalicylic_acid',
    scope: 'AGE',
    minAgeYears: 16,
    severity: 'BLOCK',
    mn: '16 нас хүрээгүй хүүхэд, өсвөр үеийнхэнд аспирин хэрэглэхийг хориглодог (Рейн синдром).',
    en: 'Aspirin is contraindicated under 16 years (Reye’s syndrome).',
    ru: 'Аспирин противопоказан детям и подросткам до 16 лет (синдром Рея).',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'acetylsalicylic_acid',
    scope: 'CONDITION',
    conditionCode: 'ulcer',
    severity: 'BLOCK',
    mn: 'Ходоодны шархлаатай үед аспирин хэрэглэхийг хориглодог.',
    en: 'Aspirin is contraindicated with a stomach ulcer.',
    ru: 'Аспирин противопоказан при язве желудка.',
    sourceKey: 'insert-ibuprofen',
  },
  {
    ingredientKey: 'acetylsalicylic_acid',
    scope: 'ALLERGY',
    conditionCode: 'nsaid',
    severity: 'BLOCK',
    mn: 'NSAID-д харшилтай хүнд аспирин хэрэглэхгүй.',
    en: 'Not for anyone allergic to NSAIDs.',
    ru: 'Не применять при аллергии на НПВП.',
    sourceKey: 'insert-ibuprofen',
  },

  // antihistamines
  {
    ingredientKey: 'loratadine',
    scope: 'AGE',
    minAgeYears: 2,
    severity: 'BLOCK',
    mn: 'Хоёр нас хүрээгүй хүүхдэд эмчийн зөвлөгөөгүйгээр хэрэглэхгүй.',
    en: 'Not for children under two years without a doctor’s advice.',
    ru: 'Не применять детям до двух лет без назначения врача.',
    sourceKey: 'insert-antihistamine',
  },
  {
    ingredientKey: 'loratadine',
    scope: 'PREGNANCY',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Жирэмсэн үед харшлын эсрэг эмийг эм зүйчийн зөвлөгөөгөөр хэрэглэнэ.',
    en: 'Antihistamine use in pregnancy needs pharmacist advice.',
    ru: 'Применение антигистаминных при беременности требует совета фармацевта.',
    sourceKey: 'insert-antihistamine',
  },
  {
    ingredientKey: 'loratadine',
    scope: 'CONDITION',
    conditionCode: 'liver_disease',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Элэгний өвчинтэй үед тунг эм зүйч тохируулна.',
    en: 'Dose adjustment in liver disease must be confirmed by a pharmacist.',
    ru: 'Коррекцию дозы при болезни печени подтверждает фармацевт.',
    sourceKey: 'insert-antihistamine',
  },
  {
    ingredientKey: 'loratadine',
    scope: 'ALLERGY',
    conditionCode: 'antihistamine_2g',
    severity: 'BLOCK',
    mn: 'Ижил төрлийн харшлын эсрэг эмэнд харшилтай хүнд хэрэглэхгүй.',
    en: 'Not for anyone allergic to this antihistamine family.',
    ru: 'Не применять при аллергии на эту группу антигистаминных.',
    sourceKey: 'insert-antihistamine',
  },
  {
    ingredientKey: 'cetirizine',
    scope: 'AGE',
    minAgeYears: 2,
    severity: 'BLOCK',
    mn: 'Хоёр нас хүрээгүй хүүхдэд эмчийн зөвлөгөөгүйгээр хэрэглэхгүй.',
    en: 'Not for children under two years without a doctor’s advice.',
    ru: 'Не применять детям до двух лет без назначения врача.',
    sourceKey: 'insert-antihistamine',
  },
  {
    ingredientKey: 'cetirizine',
    scope: 'CONDITION',
    conditionCode: 'kidney_disease',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Бөөрний өвчинтэй үед тунг эм зүйч тохируулах шаардлагатай.',
    en: 'Dose adjustment in kidney disease must be confirmed by a pharmacist.',
    ru: 'Коррекцию дозы при болезни почек подтверждает фармацевт.',
    sourceKey: 'insert-antihistamine',
  },
  {
    ingredientKey: 'cetirizine',
    scope: 'PREGNANCY',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Жирэмсэн үед эм зүйчийн зөвлөгөөгөөр хэрэглэнэ.',
    en: 'Use in pregnancy needs pharmacist advice.',
    ru: 'Применение при беременности требует совета фармацевта.',
    sourceKey: 'insert-antihistamine',
  },
  {
    ingredientKey: 'cetirizine',
    scope: 'ALLERGY',
    conditionCode: 'antihistamine_2g',
    severity: 'BLOCK',
    mn: 'Ижил төрлийн харшлын эсрэг эмэнд харшилтай хүнд хэрэглэхгүй.',
    en: 'Not for anyone allergic to this antihistamine family.',
    ru: 'Не применять при аллергии на эту группу антигистаминных.',
    sourceKey: 'insert-antihistamine',
  },

  // cough & throat
  {
    ingredientKey: 'guaifenesin',
    scope: 'AGE',
    minAgeYears: 6,
    severity: 'BLOCK',
    mn: 'Зургаан нас хүрээгүй хүүхдэд хөхний эм хэрэглэхийг зөвлөдөггүй.',
    en: 'Cough preparations are not recommended under six years.',
    ru: 'Средства от кашля не рекомендуются детям до шести лет.',
    sourceKey: 'insert-cough',
  },
  {
    ingredientKey: 'guaifenesin',
    scope: 'PREGNANCY',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Жирэмсэн үед хөхний эмийг эм зүйчийн зөвлөгөөгөөр хэрэглэнэ.',
    en: 'Cough preparations in pregnancy need pharmacist advice.',
    ru: 'Средства от кашля при беременности требуют совета фармацевта.',
    sourceKey: 'insert-cough',
  },
  {
    ingredientKey: 'menthol',
    scope: 'AGE',
    minAgeYears: 6,
    severity: 'BLOCK',
    mn: 'Ментол агуулсан бүтээгдэхүүнийг бага насны хүүхдэд хэрэглэхгүй.',
    en: 'Menthol products are not for young children.',
    ru: 'Средства с ментолом не применяют у маленьких детей.',
    sourceKey: 'insert-cough',
  },
  {
    ingredientKey: 'eucalyptus_oil',
    scope: 'AGE',
    minAgeYears: 6,
    severity: 'BLOCK',
    mn: 'Эвкалиптын тос агуулсан бүтээгдэхүүнийг бага насны хүүхдэд хэрэглэхгүй.',
    en: 'Eucalyptus oil products are not for young children.',
    ru: 'Средства с эвкалиптовым маслом не применяют у маленьких детей.',
    sourceKey: 'insert-cough',
  },

  // GI
  {
    ingredientKey: 'diosmectite',
    scope: 'AGE',
    minAgeYears: 2,
    severity: 'PHARMACIST_REVIEW',
    mn: 'Бага насны хүүхдэд тунг эм зүйч тодорхойлно.',
    en: 'For young children the dose must be set by a pharmacist.',
    ru: 'Для маленьких детей дозу определяет фармацевт.',
    sourceKey: 'insert-gi',
  },
  {
    ingredientKey: 'oral_rehydration_salts',
    scope: 'CONDITION',
    conditionCode: 'kidney_disease',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Бөөрний өвчинтэй үед электролит нөхөх бүтээгдэхүүнийг эм зүйчийн хяналтаар хэрэглэнэ.',
    en: 'Electrolyte replacement in kidney disease needs pharmacist supervision.',
    ru: 'Восполнение электролитов при болезни почек требует контроля фармацевта.',
    sourceKey: 'insert-gi',
  },
  {
    ingredientKey: 'oral_rehydration_salts',
    scope: 'CONDITION',
    conditionCode: 'diabetes',
    severity: 'WARN',
    mn: 'Найрлагад глюкоз агуулагддаг тул сахарын шижинтэй үед цусны сахараа хянана уу.',
    en: 'Contains glucose — monitor blood sugar if you have diabetes.',
    ru: 'Содержит глюкозу — при диабете контролируйте уровень сахара.',
    sourceKey: 'insert-gi',
  },

  // supplements
  {
    ingredientKey: 'magnesium',
    scope: 'CONDITION',
    conditionCode: 'kidney_disease',
    severity: 'BLOCK',
    mn: 'Бөөрний өвчинтэй үед магни хуримтлагдах эрсдэлтэй тул хэрэглэхийг хориглодог.',
    en: 'Magnesium can accumulate in kidney disease and is contraindicated.',
    ru: 'Магний может накапливаться при болезни почек — противопоказан.',
    sourceKey: 'insert-supplements',
  },
  {
    ingredientKey: 'zinc',
    scope: 'CONDITION',
    conditionCode: 'kidney_disease',
    severity: 'PHARMACIST_REVIEW',
    mn: 'Бөөрний өвчинтэй үед нэмэлт бүтээгдэхүүнийг эм зүйчийн зөвлөгөөгөөр хэрэглэнэ.',
    en: 'Supplements in kidney disease need pharmacist advice.',
    ru: 'Добавки при болезни почек требуют совета фармацевта.',
    sourceKey: 'insert-supplements',
  },
  {
    ingredientKey: 'ascorbic_acid',
    scope: 'CONDITION',
    conditionCode: 'kidney_disease',
    severity: 'WARN',
    mn: 'Их тунгаар витамин C хэрэглэх нь бөөрний өвчинтэй үед тохиромжгүй байж болно.',
    en: 'High-dose vitamin C may be unsuitable in kidney disease.',
    ru: 'Высокие дозы витамина C могут быть нежелательны при болезни почек.',
    sourceKey: 'insert-supplements',
  },
]

// ───────────────────────── interactions (§17) ──────────────────────────────

interface InteractionSeed {
  a: string
  b: string
  status: 'SAFE' | 'CAUTION' | 'SIGNIFICANT_RISK' | 'UNKNOWN'
  mn: string
  en: string
  ru: string
}

const INTERACTIONS: InteractionSeed[] = [
  {
    a: 'ibuprofen',
    b: 'acetylsalicylic_acid',
    status: 'SIGNIFICANT_RISK',
    mn: 'Хоёр NSAID-ыг хамт хэрэглэвэл ходоодны цус алдалтын эрсдэл нэмэгдэж, аспириныг зүрхний сэргийлэлтэд хэрэглэж байгаа үйлчлэлийг сулруулна.',
    en: 'Two NSAIDs together raise the risk of gastric bleeding and blunt aspirin’s cardiac protection.',
    ru: 'Два НПВП вместе повышают риск желудочного кровотечения и снижают защитное действие аспирина.',
  },
  {
    a: 'ibuprofen',
    b: 'warfarin',
    status: 'SIGNIFICANT_RISK',
    mn: 'NSAID нь варфаринтай хамт хэрэглэхэд цус алдалтын эрсдлийг ихээхэн нэмэгдүүлдэг.',
    en: 'NSAIDs substantially increase bleeding risk with warfarin.',
    ru: 'НПВП существенно повышают риск кровотечения при приёме варфарина.',
  },
  {
    a: 'acetylsalicylic_acid',
    b: 'warfarin',
    status: 'SIGNIFICANT_RISK',
    mn: 'Аспирин варфаринтай хамт хэрэглэхэд цус алдалтын эрсдэл өндөр.',
    en: 'Aspirin with warfarin carries a high bleeding risk.',
    ru: 'Аспирин с варфарином несёт высокий риск кровотечения.',
  },
  {
    a: 'ibuprofen',
    b: 'enalapril',
    status: 'CAUTION',
    mn: 'NSAID нь даралт буулгах эмийн үйлчлэлийг сулруулж, бөөрний ажиллагаанд нөлөөлж болно. Эм зүйчтэй зөвлөнө үү.',
    en: 'NSAIDs can reduce the effect of blood-pressure medicines and affect kidney function. Consult a pharmacist.',
    ru: 'НПВП могут снижать действие гипотензивных и влиять на функцию почек. Обратитесь к фармацевту.',
  },
  {
    a: 'ibuprofen',
    b: 'amlodipine',
    status: 'CAUTION',
    mn: 'NSAID нь даралт буулгах эмийн үйлчлэлийг сулруулж болно.',
    en: 'NSAIDs may reduce the effect of blood-pressure medicines.',
    ru: 'НПВП могут снижать действие гипотензивных средств.',
  },
  {
    a: 'ibuprofen',
    b: 'metformin',
    status: 'CAUTION',
    mn: 'Шүүс дутагдалтай үед NSAID нь бөөрний ажиллагаанд нөлөөлж, метформины эрсдлийг нэмэгдүүлж болно.',
    en: 'With dehydration, NSAIDs can affect kidney function and increase metformin risk.',
    ru: 'При обезвоживании НПВП влияют на почки и повышают риск при приёме метформина.',
  },
  {
    a: 'ibuprofen',
    b: 'salbutamol',
    status: 'CAUTION',
    mn: 'Астмын шинжтэй хүнд NSAID амьсгалын шинжийг сэдрээж болзошгүй.',
    en: 'In people with asthma, NSAIDs may trigger respiratory symptoms.',
    ru: 'У людей с астмой НПВП могут провоцировать симптомы со стороны дыхания.',
  },
  {
    a: 'paracetamol',
    b: 'warfarin',
    status: 'CAUTION',
    mn: 'Парацетамолыг тогтмол хэрэглэвэл варфарины үйлчлэл (INR) өөрчлөгдөж болно. Эм зүйчтэй зөвлөнө үү.',
    en: 'Regular paracetamol can alter warfarin control (INR). Consult a pharmacist.',
    ru: 'Регулярный прием парацетамола может изменить контроль варфарина (INR). Обратитесь к фармацевту.',
  },
  {
    a: 'paracetamol',
    b: 'ibuprofen',
    status: 'SAFE',
    mn: 'Эм зүйчийн зөвлөснөөр эдгээрийг сольж хэрэглэж болдог. Тус бүрийн зааврыг дагана уу.',
    en: 'These may be alternated on a pharmacist’s advice. Follow each package label.',
    ru: 'Их можно чередовать по совету фармацевта. Следуйте инструкции каждого средства.',
  },
  {
    a: 'ibuprofen',
    b: 'omeprazole',
    status: 'SAFE',
    mn: 'Ходоодыг хамгаалах зорилгоор хамт хэрэглэдэг тохиолдол байдаг. Эмчийн зааврыг дагана уу.',
    en: 'These are sometimes used together for gastric protection. Follow your doctor’s instructions.',
    ru: 'Иногда применяются вместе для защиты желудка. Следуйте назначению врача.',
  },
  {
    a: 'cetirizine',
    b: 'loratadine',
    status: 'CAUTION',
    mn: 'Хоёулаа ижил төрлийн харшлын эсрэг эм тул давхар хэрэглэх шаардлагагүй.',
    en: 'Both are the same class of antihistamine — taking both adds no benefit.',
    ru: 'Оба относятся к одной группе антигистаминных — совместный приём не нужен.',
  },
  {
    a: 'diosmectite',
    b: 'paracetamol',
    status: 'CAUTION',
    mn: 'Гэдэсний адсорбент бусад эмийн шимэгдэлтийг багасгадаг тул 2 цагийн зайтай хэрэглэнэ.',
    en: 'An intestinal adsorbent reduces absorption of other medicines — separate doses by two hours.',
    ru: 'Адсорбент снижает всасывание других лекарств — принимайте с интервалом два часа.',
  },
  {
    a: 'diosmectite',
    b: 'loratadine',
    status: 'CAUTION',
    mn: 'Гэдэсний адсорбент бусад эмийн шимэгдэлтийг багасгадаг тул 2 цагийн зайтай хэрэглэнэ.',
    en: 'An intestinal adsorbent reduces absorption of other medicines — separate doses by two hours.',
    ru: 'Адсорбент снижает всасывание других лекарств — принимайте с интервалом два часа.',
  },
  {
    a: 'diosmectite',
    b: 'levothyroxine',
    status: 'CAUTION',
    mn: 'Адсорбент нь левотироксины шимэгдэлтийг багасгадаг тул хэрэглэх цагийг зайлуулна.',
    en: 'The adsorbent reduces levothyroxine absorption — separate the doses.',
    ru: 'Адсорбент снижает всасывание левотироксина — разделяйте приёмы.',
  },
  {
    a: 'magnesium',
    b: 'levothyroxine',
    status: 'CAUTION',
    mn: 'Магни левотироксины шимэгдэлтийг багасгадаг тул 4 цагийн зайтай хэрэглэнэ.',
    en: 'Magnesium reduces levothyroxine absorption — separate by four hours.',
    ru: 'Магний снижает всасывание левотироксина — разделяйте на четыре часа.',
  },
  {
    a: 'zinc',
    b: 'amoxicillin',
    status: 'CAUTION',
    mn: 'Цайр нь тодорхой антибиотикийн шимэгдэлтийг багасгаж болно.',
    en: 'Zinc may reduce absorption of certain antibiotics.',
    ru: 'Цинк может снижать всасывание некоторых антибиотиков.',
  },
]

// ────────────────────────────────── seeding ────────────────────────────────

export async function seedConsultationKnowledge() {
  const approver = await prisma.user.findFirst({
    where: { email: 'pharmacist@ilikon.mn' },
    select: { id: true, fullName: true, licenseNumber: true },
  })
  const approvedAt = daysAgo(20)

  // ── sources ───────────────────────────────────────────────────────────
  const sourceIds = new Map<string, string>()
  for (const source of SOURCES) {
    const row = await prisma.knowledgeSource.upsert({
      where: { key: source.key },
      create: {
        key: source.key,
        sourceType: source.sourceType,
        title: source.title,
        reference: source.reference,
        version: source.version,
        body: source.body ?? null,
        approvedBy: approver ? `${approver.fullName} (${approver.licenseNumber ?? 'ФА'})` : null,
        approvedById: approver?.id ?? null,
        approvedAt,
        isActive: true,
      },
      update: { version: source.version, title: source.title, isActive: true },
    })
    sourceIds.set(source.key, row.id)
  }
  console.log(`  ✓ ${SOURCES.length} knowledge sources`)

  // ── ingredients and aliases ───────────────────────────────────────────
  for (const ingredient of INGREDIENTS) {
    await prisma.activeIngredient.upsert({
      where: { key: ingredient.key },
      create: {
        key: ingredient.key,
        name: ingredient.name,
        nameMn: ingredient.nameMn,
        nameRu: ingredient.nameRu,
        className: ingredient.className ?? null,
        classKey: ingredient.classKey ?? null,
        isOtc: ingredient.isOtc,
      },
      update: {
        name: ingredient.name,
        nameMn: ingredient.nameMn,
        classKey: ingredient.classKey ?? null,
        isOtc: ingredient.isOtc,
      },
    })

    for (const alias of ingredient.aliases) {
      await prisma.medicationAlias.upsert({
        where: { alias: alias.toLowerCase() },
        create: { alias: alias.toLowerCase(), ingredientKey: ingredient.key },
        update: { ingredientKey: ingredient.key },
      })
    }
  }
  const aliasCount = INGREDIENTS.reduce((n, i) => n + i.aliases.length, 0)
  console.log(`  ✓ ${INGREDIENTS.length} active ingredients, ${aliasCount} aliases`)

  // ── product → ingredient links ────────────────────────────────────────
  let linked = 0
  for (const entry of PRODUCT_INGREDIENTS) {
    const product = await prisma.product.findUnique({
      where: { sku: entry.sku },
      select: { id: true },
    })
    if (!product) continue

    for (const ingredient of entry.ingredients) {
      await prisma.productIngredient.upsert({
        where: {
          productId_ingredientKey: { productId: product.id, ingredientKey: ingredient.key },
        },
        create: {
          productId: product.id,
          ingredientKey: ingredient.key,
          strengthLabel: ingredient.strengthLabel ?? null,
          isPrimary: ingredient.primary ?? true,
        },
        update: { strengthLabel: ingredient.strengthLabel ?? null },
      })
      linked += 1
    }
  }
  console.log(`  ✓ ${linked} product-ingredient links`)

  // ── guidelines ────────────────────────────────────────────────────────
  for (const guideline of GUIDELINES) {
    await prisma.otcGuideline.upsert({
      where: { key: guideline.key },
      create: {
        key: guideline.key,
        symptomCode: guideline.symptomCode,
        title: guideline.title,
        categorySlugs: guideline.categorySlugs,
        ingredientKeys: guideline.ingredientKeys,
        minAgeYears: guideline.minAgeYears ?? null,
        maxSelfCareDays: guideline.maxSelfCareDays,
        rationaleMn: guideline.rationaleMn,
        rationaleEn: guideline.rationaleEn,
        rationaleRu: guideline.rationaleRu,
        precautionMn: guideline.precautionMn ?? null,
        precautionEn: guideline.precautionEn ?? null,
        precautionRu: guideline.precautionRu ?? null,
        pregnancyNeedsPharmacist: guideline.pregnancyNeedsPharmacist ?? true,
        sourceId: sourceIds.get(guideline.sourceKey) ?? null,
        isActive: true,
      },
      update: {
        categorySlugs: guideline.categorySlugs,
        ingredientKeys: guideline.ingredientKeys,
        maxSelfCareDays: guideline.maxSelfCareDays,
        minAgeYears: guideline.minAgeYears ?? null,
        sourceId: sourceIds.get(guideline.sourceKey) ?? null,
        isActive: true,
      },
    })
  }
  console.log(`  ✓ ${GUIDELINES.length} OTC guidelines`)

  // ── contraindications ─────────────────────────────────────────────────
  // Replaced wholesale: a rule that has been withdrawn clinically must not
  // survive a re-seed just because nothing references it any more.
  await prisma.contraindicationRule.deleteMany({})
  for (const rule of CONTRA) {
    await prisma.contraindicationRule.create({
      data: {
        ingredientKey: rule.ingredientKey,
        scope: rule.scope,
        severity: rule.severity,
        conditionCode: rule.conditionCode ?? null,
        minAgeYears: rule.minAgeYears ?? null,
        maxAgeYears: rule.maxAgeYears ?? null,
        messageMn: rule.mn,
        messageEn: rule.en,
        messageRu: rule.ru,
        sourceId: sourceIds.get(rule.sourceKey) ?? null,
        isActive: true,
      },
    })
  }
  console.log(`  ✓ ${CONTRA.length} contraindication rules`)

  // ── interactions ──────────────────────────────────────────────────────
  const interactionSourceId = sourceIds.get('interaction-db-2026') ?? null
  for (const interaction of INTERACTIONS) {
    // Keys are stored sorted so a pair is unique regardless of query order.
    const [a, b] = [interaction.a, interaction.b].sort()
    await prisma.interactionRule.upsert({
      where: { ingredientKeyA_ingredientKeyB: { ingredientKeyA: a!, ingredientKeyB: b! } },
      create: {
        ingredientKeyA: a!,
        ingredientKeyB: b!,
        status: interaction.status,
        adviceMn: interaction.mn,
        adviceEn: interaction.en,
        adviceRu: interaction.ru,
        sourceId: interactionSourceId,
        isActive: true,
      },
      update: {
        status: interaction.status,
        adviceMn: interaction.mn,
        adviceEn: interaction.en,
        adviceRu: interaction.ru,
        isActive: true,
      },
    })
  }
  console.log(`  ✓ ${INTERACTIONS.length} interaction rules`)
}

// ─────────────────────── demo consultations (§22) ──────────────────────────

/**
 * Demo consultations so the admin dashboard has a realistic funnel on a fresh
 * install: one emergency referral, one urgent, two pharmacist referrals (one of
 * them already reviewed) and two clean self-care outcomes.
 *
 * These rows are written directly rather than by running the pipeline, so the
 * seed needs neither an API key nor the safety engines — but the shape is
 * exactly what the engine produces, including the audit trail.
 */
interface DemoAnswer {
  key: string
  step: string
  question: string
  value: unknown
  label: string
  probe?: boolean
}

interface DemoConsultation {
  email: string | null
  locale: 'mn' | 'en' | 'ru'
  daysAgo: number
  ageBand: string
  exactAgeYears?: number
  sex: string
  pregnancy?: string
  symptom: string
  secondary?: string[]
  freeText?: string
  onset: string
  severity: number
  course: string
  worsening: boolean
  conditions?: string[]
  allergies?: { medication: string; reaction: string; ingredientKey?: string }[]
  medications?: { name: string; dose?: string; ingredientKey?: string; unresolved?: boolean }[]
  redFlags?: { code: string; label: string; severity: 'EMERGENCY' | 'URGENT'; source: string; evidence?: string }[]
  triage: 'EMERGENCY' | 'URGENT_MEDICAL_REVIEW' | 'PHARMACIST_CONSULTATION' | 'SELF_CARE'
  recommendationType: 'EMERGENCY_CARE' | 'DOCTOR_REVIEW' | 'PHARMACIST_CONSULT' | 'OTC_GUIDANCE'
  triageReason: string
  understood: string
  safety: string
  nextStep: string
  precautions: string
  seekCare: string
  products?: {
    sku: string
    status: 'SAFE_TO_SHOW' | 'PHARMACIST_REVIEW_REQUIRED' | 'BLOCKED'
    interaction: 'SAFE' | 'CAUTION' | 'SIGNIFICANT_RISK' | 'UNKNOWN'
    reason: string
    safetyNotes?: string
    blockedReason?: string
    safetyScore: number
  }[]
  safetyChecks?: {
    sku?: string
    type: string
    outcome: 'PASS' | 'WARN' | 'BLOCK' | 'UNKNOWN'
    code: string
    detail: string
  }[]
  handedOff?: boolean
  review?: {
    action: 'ACCEPT' | 'MODIFY' | 'REJECT' | 'NOTE' | 'REQUEST_INFO' | 'RECOMMEND_PRODUCT'
    recommendation?: string
    reason?: string
    note?: string
  }
  llmUsed?: boolean
}

const DEMO: DemoConsultation[] = [
  {
    email: 'ganzorig@example.mn',
    locale: 'mn',
    daysAgo: 1,
    ageBand: 'AGE_18_64',
    sex: 'MALE',
    symptom: 'headache',
    freeText: 'Гэнэт хүчтэй толгой өвдөж, зүүн гар мэдээ алдаж байна.',
    onset: 'under_6h',
    severity: 9,
    course: 'ACUTE',
    worsening: true,
    redFlags: [
      {
        code: 'sudden_severe_headache',
        label: 'Гэнэт хүчтэй толгой өвдөх',
        severity: 'EMERGENCY',
        source: 'FREE_TEXT',
        evidence: 'Гэнэт хүчтэй толгой өвдөж',
      },
      {
        code: 'sudden_weakness',
        label: 'Гэнэтийн хүч дутагдал, мэдээ алдах',
        severity: 'EMERGENCY',
        source: 'RULE',
        evidence: 'Тийм',
      },
    ],
    triage: 'EMERGENCY',
    recommendationType: 'EMERGENCY_CARE',
    triageReason: 'Яаралтай эмнэлгийн үнэлгээ шаардаж болох шинж тэмдэг сонгогдсон.',
    understood: 'Та гэнэт хүчтэй толгой өвдөх, нэг талын мэдээ алдалтын талаар мэдээлэл өглөө.',
    safety:
      'Таны хэлсэн шинж тэмдэг яаралтай эмнэлгийн үнэлгээ шаарддаг байж болзошгүй. Иликон эм санал болгохын оронд яаралтай мэргэжлийн тусламж авахыг зөвлөж байна. Яаралтай тусламж: 103.',
    nextStep: 'Одоо яаралтай тусламжийн дугаарт холбогдох эсвэл хамгийн ойрын эмнэлгийн яаралтай тасагт хандана уу.',
    precautions: '',
    seekCare: 'Одоо яаралтай тусламжийн дугаарт холбогдоно уу. (103)',
  },
  {
    email: 'altantsetseg@example.mn',
    locale: 'mn',
    daysAgo: 2,
    ageBand: 'AGE_18_64',
    sex: 'FEMALE',
    pregnancy: 'NEITHER',
    symptom: 'cough',
    secondary: ['fever'],
    onset: 'weeks_1_4',
    severity: 6,
    course: 'PERSISTENT',
    worsening: true,
    conditions: ['asthma'],
    medications: [{ name: 'Вентолин', dose: '100 мкг', ingredientKey: 'salbutamol' }],
    redFlags: [
      {
        code: 'blood_in_sputum',
        label: 'Цэрэнд цус холилдох',
        severity: 'URGENT',
        source: 'RULE',
        evidence: 'Тийм',
      },
    ],
    triage: 'URGENT_MEDICAL_REVIEW',
    recommendationType: 'DOCTOR_REVIEW',
    triageReason:
      'Эмчийн хурдан үзлэг шаардаж болох шинж тэмдэг байна. Зовиур өөрөө эмчлэх хугацаанаас хэтэрсэн байна.',
    understood: 'Та 2 долоо хоногоос дээш үргэлжилсэн хөх, халуурал, цэрэнд цус холилдох талаар мэдээлэл өглөө.',
    safety:
      'Таны хэлсэн байдал эмчийн үзлэгийг хойшлуулахгүй байхыг шаардаж байна. Эмийн сангийн бүтээгдэхүүнээр өөрөө эмчлэх нь тохиромжгүй.',
    nextStep: 'Өнөөдөр эмч, эмнэлэгт хандаж үзлэг хийлгэнэ үү.',
    precautions:
      'Эмийг савлагааны заавар эсвэл эм зүйчийн зөвлөмжийн дагуу хэрэглэнэ үү. Ижил идэвхтэй найрлага агуулсан бүтээгдэхүүнийг давхардуулахаас зайлсхийгээрэй.',
    seekCare:
      'Байдал дордвол, амьсгал давчдах, цээж өвдөх шинж гарвал эмнэлгийн тусламж нэн даруй авна уу.',
    handedOff: true,
  },
  {
    email: 'delgermaa@example.mn',
    locale: 'mn',
    daysAgo: 3,
    ageBand: 'AGE_18_64',
    sex: 'FEMALE',
    pregnancy: 'PREGNANT',
    symptom: 'headache',
    onset: 'days_1_3',
    severity: 5,
    course: 'ACUTE',
    worsening: false,
    allergies: [{ medication: 'Ибупрофен', reaction: 'Тууралт', ingredientKey: 'ibuprofen' }],
    triage: 'PHARMACIST_CONSULTATION',
    recommendationType: 'PHARMACIST_CONSULT',
    triageReason:
      'Жирэмсэн, жирэмсэн байж магадгүй эсвэл хөхүүл байдал — эм зүйчийн үнэлгээ шаардлагатай. Эмийн харшил бүртгэгдсэн тул сонголтыг эм зүйч баталгаажуулна.',
    understood: 'Та 1–3 хоног үргэлжилсэн толгой өвдөлтийн талаар мэдээлэл өглөө.',
    safety:
      'Танд жоргүй бүтээгдэхүүний сонголт байж болох ч мэргэжлийн эм зүйч танай нөхцөлд тохирохыг эхлээд хянах шаардлагатай.',
    nextStep: 'Таны мэдээлэлд үндэслэн эм зүйчтэй зөвлөөд жоргүй бүтээгдэхүүний сонголтыг авч үзэж болно.',
    precautions:
      'Жирэмсэн үед хэрэглэхээс өмнө эм зүйч, эмчтэй зөвлөнө үү. Эмийг савлагааны зааврын дагуу хэрэглэнэ үү.',
    seekCare:
      'Толгой өвдөлт хүчтэй болох, хараа өөрчлөгдөх, хэвлий өвдөх, цус гарах шинж илэрвэл нэн даруй эмнэлэгт хандана уу.',
    products: [
      {
        sku: 'ILK-PAR-500',
        status: 'PHARMACIST_REVIEW_REQUIRED',
        interaction: 'SAFE',
        reason:
          'Хөнгөн, дунд зэргийн толгой өвдөлтийг түр зуур хөнгөвчлөхөд өвдөлт намдаах ангиллын бүтээгдэхүүн тохирч болно. Үйлчлэгч бодис: Paracetamol.',
        safetyNotes: 'Жирэмсэн үед хэрэглэхээс өмнө эм зүйч, эмчтэй зөвлөнө үү.',
        safetyScore: 85,
      },
      {
        sku: 'ILK-IBU-400',
        status: 'BLOCKED',
        interaction: 'SAFE',
        reason: '',
        blockedReason: 'Та харшилтай гэж бүртгүүлсэн үйлчлэгч бодис агуулагдаж байна. Энэ бүтээгдэхүүнийг санал болгохгүй.',
        safetyScore: 0,
      },
    ],
    safetyChecks: [
      {
        sku: 'ILK-IBU-400',
        type: 'ALLERGY',
        outcome: 'BLOCK',
        code: 'allergy.direct_match',
        detail: 'Та харшилтай гэж бүртгүүлсэн үйлчлэгч бодис агуулагдаж байна.',
      },
      {
        sku: 'ILK-IBU-400',
        type: 'PREGNANCY',
        outcome: 'BLOCK',
        code: 'pregnancy.contraindicated',
        detail: 'Жирэмсэн үед, ялангуяа гурав дахь гурван сард NSAID хэрэглэхийг хориглодог.',
      },
      {
        sku: 'ILK-PAR-500',
        type: 'PREGNANCY',
        outcome: 'WARN',
        code: 'pregnancy.contraindicated',
        detail: 'Жирэмсэн үед хэрэглэхээс өмнө эм зүйч, эмчтэй зөвлөнө үү.',
      },
    ],
    handedOff: true,
    review: {
      action: 'MODIFY',
      recommendation:
        'Жирэмсний хугацаанд толгой өвдөлтөд парацетамол агуулсан бүтээгдэхүүнийг хамгийн бага тунгаар, хамгийн бага хугацаанд хэрэглэхийг зөвлөв. Ибупрофеныг бүрмөсөн хассан.',
      reason: 'Жирэмсэн байдал болон ибупрофены харшил тул NSAID-ыг хассан.',
      note: 'Харилцагчтай утсаар зөвлөлдсөн. 2 хоногийн дараа сайжрахгүй бол эмчид хандахыг сануулсан.',
    },
  },
  {
    email: 'batbold@example.mn',
    locale: 'en',
    daysAgo: 4,
    ageBand: 'AGE_65_PLUS',
    exactAgeYears: 71,
    sex: 'MALE',
    symptom: 'joint_pain',
    onset: 'days_4_7',
    severity: 6,
    course: 'RECURRENT',
    worsening: false,
    conditions: ['hypertension', 'diabetes'],
    medications: [
      { name: 'Enalapril', dose: '10 mg', ingredientKey: 'enalapril' },
      { name: 'Metformin', dose: '850 mg', ingredientKey: 'metformin' },
      { name: 'Herbal joint capsules', unresolved: true },
    ],
    triage: 'PHARMACIST_CONSULTATION',
    recommendationType: 'PHARMACIST_CONSULT',
    triageReason:
      'Age 65+ — a pharmacist should check interactions and kidney function. Several concurrent medicines — a pharmacist will check interactions.',
    understood: 'You reported: Joint pain · 4–7 days · 6/10.',
    safety:
      'An over-the-counter option may exist, but a pharmacist needs to check that it fits your situation first.',
    nextStep: 'Based on your information, consult our pharmacist and then consider the over-the-counter options.',
    precautions:
      'NSAIDs can raise blood pressure and blunt antihypertensive medicines. A pharmacist needs to confirm whether this combination is safe. Use any medicine according to the package label or your pharmacist’s instructions.',
    seekCare:
      'Seek medical care promptly if the joint becomes hot and swollen, if you develop a fever, or if there is no improvement within a few days.',
    products: [
      {
        sku: 'ILK-PAR-500',
        status: 'PHARMACIST_REVIEW_REQUIRED',
        interaction: 'UNKNOWN',
        reason:
          'A pain-relief product may temporarily ease mild joint discomfort. Active ingredient: Paracetamol.',
        safetyNotes: 'A pharmacist needs to confirm whether this combination is safe (Herbal joint capsules).',
        safetyScore: 75,
      },
      {
        sku: 'ILK-IBU-400',
        status: 'PHARMACIST_REVIEW_REQUIRED',
        interaction: 'CAUTION',
        reason:
          'A pain-relief product may temporarily ease mild joint discomfort. Active ingredient: Ibuprofen.',
        safetyNotes:
          'NSAIDs can reduce the effect of blood-pressure medicines and affect kidney function. Consult a pharmacist.',
        safetyScore: 42,
      },
    ],
    safetyChecks: [
      {
        sku: 'ILK-IBU-400',
        type: 'CONDITION',
        outcome: 'WARN',
        code: 'condition.contraindicated',
        detail: 'NSAIDs can raise blood pressure and blunt antihypertensive medicines.',
      },
      {
        sku: 'ILK-IBU-400',
        type: 'INTERACTION',
        outcome: 'WARN',
        code: 'interaction.caution',
        detail: 'NSAIDs can reduce the effect of blood-pressure medicines and affect kidney function.',
      },
      {
        type: 'INTERACTION',
        outcome: 'UNKNOWN',
        code: 'interaction.unresolved_medication',
        detail: 'A pharmacist needs to confirm whether this combination is safe (Herbal joint capsules).',
      },
    ],
    llmUsed: true,
  },
  {
    email: 'uranchimeg@example.mn',
    locale: 'mn',
    daysAgo: 6,
    ageBand: 'AGE_18_64',
    sex: 'FEMALE',
    pregnancy: 'NEITHER',
    symptom: 'allergy',
    secondary: ['runny_nose'],
    onset: 'days_1_3',
    severity: 4,
    course: 'ACUTE',
    worsening: false,
    triage: 'SELF_CARE',
    recommendationType: 'OTC_GUIDANCE',
    triageReason: '',
    understood: 'Та Харшлын шинж, Хамар нусгайрах гэсэн зовиурын талаар мэдээлэл өглөө.',
    safety:
      'Таны хэлсэн мэдээлэлд үндэслэвэл өөрөө тусламжийн ерөнхий зөвлөгөө болон жоргүй бүтээгдэхүүний мэдээлэл тохиромжтой байж болно.',
    nextStep:
      'Доорх жоргүй бүтээгдэхүүний сонголтыг харж, савлагааны зааврыг дагана уу. Хэрэв эргэлзвэл эм зүйчээс асуугаарай.',
    precautions:
      'Хавагнах, амьсгалахад хүндрэх шинж илэрвэл энэ нь яаралтай тусламж шаардана. Эмийг савлагааны заавар эсвэл эм зүйчийн зөвлөмжийн дагуу хэрэглэнэ үү.',
    seekCare:
      'Байдал дордвол, 3–5 хоногт сайжрахгүй бол эмнэлгийн тусламж авна уу.',
    products: [
      {
        sku: 'ILK-LOR-10',
        status: 'SAFE_TO_SHOW',
        interaction: 'SAFE',
        reason:
          'Харшлын эсрэг (антихистамин) ангиллын бүтээгдэхүүн харшлын хөнгөн шинжийг хөнгөвчлөхөд тохирч болно. Үйлчлэгч бодис: Loratadine.',
        safetyScore: 100,
      },
      {
        sku: 'ILK-CETI-10',
        status: 'SAFE_TO_SHOW',
        interaction: 'SAFE',
        reason:
          'Харшлын эсрэг (антихистамин) ангиллын бүтээгдэхүүн харшлын хөнгөн шинжийг хөнгөвчлөхөд тохирч болно. Үйлчлэгч бодис: Cetirizine.',
        safetyScore: 100,
      },
    ],
    llmUsed: true,
  },
  {
    email: 'tuvshin@example.mn',
    locale: 'ru',
    daysAgo: 8,
    ageBand: 'AGE_18_64',
    sex: 'MALE',
    symptom: 'sore_throat',
    onset: 'today',
    severity: 3,
    course: 'ACUTE',
    worsening: false,
    triage: 'SELF_CARE',
    recommendationType: 'OTC_GUIDANCE',
    triageReason: '',
    understood: 'Вы сообщили о: Боль в горле · Сегодня · 3/10.',
    safety:
      'Судя по вашим ответам, общие рекомендации по самопомощи и безрецептурные средства могут подойти.',
    nextStep:
      'Ознакомьтесь с безрецептурными вариантами ниже и следуйте инструкции на упаковке. При сомнениях спросите фармацевта.',
    precautions:
      'При длительности более 5 дней, трудностях глотания или высокой температуре — к врачу. Применяйте лекарство согласно инструкции на упаковке.',
    seekCare:
      'Немедленно обратитесь за медицинской помощью при ухудшении или отсутствии улучшения за 3–5 дней.',
    products: [
      {
        sku: 'ILK-THROAT-LOZ',
        status: 'SAFE_TO_SHOW',
        interaction: 'SAFE',
        reason:
          'Смягчающие пастилки и обезболивающее могут облегчить боль в горле. Действующее вещество: Menthol, Eucalyptus oil.',
        safetyScore: 100,
      },
      {
        sku: 'ILK-PAR-500',
        status: 'SAFE_TO_SHOW',
        interaction: 'SAFE',
        reason: 'Смягчающие пастилки и обезболивающее могут облегчить боль в горле. Действующее вещество: Paracetamol.',
        safetyScore: 100,
      },
    ],
  },
]

function demoAnswers(demo: DemoConsultation): DemoAnswer[] {
  const answers: DemoAnswer[] = [
    { key: 'age_band', step: 'BASICS', question: 'Өвчтөний нас хэд вэ?', value: demo.ageBand, label: demo.ageBand },
    { key: 'sex', step: 'BASICS', question: 'Хүйс', value: demo.sex, label: demo.sex },
  ]
  if (demo.pregnancy) {
    answers.push({
      key: 'pregnancy',
      step: 'BASICS',
      question: 'Жирэмсэн эсвэл хөхүүл эсэх',
      value: demo.pregnancy,
      label: demo.pregnancy,
    })
  }
  answers.push({
    key: 'primary_symptom',
    step: 'COMPLAINT',
    question: 'Танд яг ямар зовиур байна вэ?',
    value: demo.symptom,
    label: demo.symptom,
  })
  if (demo.freeText) {
    answers.push({
      key: 'symptom_free_text',
      step: 'COMPLAINT',
      question: 'Зовиураа өөрийн үгээр тайлбарлана уу',
      value: demo.freeText,
      label: demo.freeText,
    })
  }
  if (demo.secondary?.length) {
    answers.push({
      key: 'secondary_symptoms',
      step: 'COMPLAINT',
      question: 'Хамт байгаа бусад зовиур байвал сонгоно уу',
      value: demo.secondary,
      label: demo.secondary.join(', '),
    })
  }
  answers.push(
    { key: 'onset', step: 'SYMPTOM_DETAILS', question: 'Хэзээнээс эхэлсэн вэ?', value: demo.onset, label: demo.onset },
    {
      key: 'severity',
      step: 'SYMPTOM_DETAILS',
      question: 'Хүндрэлийг 0–10 хооронд үнэлнэ үү',
      value: demo.severity,
      label: String(demo.severity),
    },
    { key: 'course', step: 'SYMPTOM_DETAILS', question: 'Хэрхэн явагдаж байна вэ?', value: demo.course, label: demo.course },
    {
      key: 'worsening',
      step: 'SYMPTOM_DETAILS',
      question: 'Байдал дордож байна уу?',
      value: demo.worsening ? 'yes' : 'no',
      label: demo.worsening ? 'Тийм' : 'Үгүй',
    },
    {
      key: 'conditions',
      step: 'MEDICAL_HISTORY',
      question: 'Танд эмчийн онош тавьсан архаг өвчин байдаг уу?',
      value: demo.conditions ?? [],
      label: (demo.conditions ?? []).join(', ') || '—',
    },
    {
      key: 'allergy_declared',
      step: 'ALLERGIES',
      question: 'Танд ямар нэгэн эмийн харшил байдаг уу?',
      value: demo.allergies?.length ? 'yes' : 'no',
      label: demo.allergies?.length ? 'Тийм' : 'Үгүй',
    },
    {
      key: 'current_medications',
      step: 'MEDICATIONS',
      question: 'Одоогоор ямар эм, витамин эсвэл нэмэлт бүтээгдэхүүн хэрэглэж байна вэ?',
      value: demo.medications ?? [],
      label: (demo.medications ?? []).map((m) => [m.name, m.dose].filter(Boolean).join(' ')).join('; ') || '—',
    },
    {
      key: 'red_flag_checklist',
      step: 'RED_FLAG_SCREENING',
      question: 'Доорхоос ямар нэг шинж тэмдэг байвал сонгоно уу',
      value: (demo.redFlags ?? []).filter((f) => f.source === 'RULE').map((f) => f.code),
      label: (demo.redFlags ?? []).filter((f) => f.source === 'RULE').map((f) => f.label).join(', ') || '—',
      probe: true,
    },
  )
  return answers
}

export async function seedDemoConsultations() {
  const existing = await prisma.consultation.count()
  if (existing > 0) {
    console.log(`  • ${existing} consultations already present — skipped`)
    return
  }

  const pharmacist = await prisma.user.findFirst({
    where: { email: 'pharmacist@ilikon.mn' },
    select: { id: true, fullName: true },
  })

  let created = 0
  for (const [index, demo] of DEMO.entries()) {
    const customer = demo.email
      ? await prisma.user.findFirst({ where: { email: demo.email }, select: { id: true } })
      : null

    const createdAt = daysAgo(demo.daysAgo)
    const datePart = [
      createdAt.getFullYear(),
      String(createdAt.getMonth() + 1).padStart(2, '0'),
      String(createdAt.getDate()).padStart(2, '0'),
    ].join('')

    const consultation = await prisma.consultation.create({
      data: {
        code: `AIC-${datePart}-${String(index + 1).padStart(4, '0')}`,
        sessionKey: `ac_demo_${index + 1}_${datePart}`,
        userId: customer?.id ?? null,
        locale: demo.locale,
        status: demo.review ? 'REVIEWED' : demo.handedOff ? 'PHARMACIST_REVIEW' : 'ASSESSED',
        currentStep: 'RESULT',
        disclaimerAcceptedAt: createdAt,
        disclaimerVersion: 'disc-2026.08.1',
        ageBand: demo.ageBand as never,
        exactAgeYears: demo.exactAgeYears ?? null,
        sex: demo.sex as never,
        pregnancy: (demo.pregnancy ?? null) as never,
        primarySymptom: demo.symptom,
        symptomFreeText: demo.freeText ?? null,
        secondarySymptoms: demo.secondary ?? [],
        onsetCode: demo.onset,
        severity: demo.severity,
        course: demo.course as never,
        worsening: demo.worsening,
        triageLevel: demo.triage as never,
        recommendationType: demo.recommendationType as never,
        triageReason: demo.triageReason || null,
        aiUnderstood: demo.understood,
        aiSafetyAssessment: demo.safety,
        aiNextStep: demo.nextStep,
        aiPrecautions: demo.precautions || null,
        aiSeekCare: demo.seekCare,
        selfCareEligible: demo.triage === 'SELF_CARE',
        pharmacistReviewRequired: demo.triage !== 'SELF_CARE',
        aiModel: demo.llmUsed ? 'claude-opus-5' : null,
        promptVersion: 'cons-prompt-2026.08.1',
        rulesVersion: 'q-2026.08.1|rf-2026.08.1|tri-2026.08.1|ci-2026.08.1|ix-2026.08.1',
        llmUsed: Boolean(demo.llmUsed),
        startedAt: createdAt,
        assessedAt: createdAt,
        completedAt: createdAt,
        handedOffAt: demo.handedOff || demo.review ? createdAt : null,
        reviewedAt: demo.review ? createdAt : null,
        expiresAt: new Date(createdAt.getTime() + 365 * 86_400_000),
        createdAt,
      },
    })

    // ── answers ──────────────────────────────────────────────────────────
    const answers = demoAnswers(demo)
    await prisma.consultationAnswer.createMany({
      data: answers.map((answer, order) => ({
        consultationId: consultation.id,
        step: answer.step as never,
        questionKey: answer.key,
        questionText: answer.question,
        answerValue: (answer.value ?? null) as never,
        answerLabel: answer.label,
        isRedFlagProbe: Boolean(answer.probe),
        sortOrder: order + 1,
        askedAt: createdAt,
        answeredAt: createdAt,
      })),
    })

    if (demo.conditions?.length) {
      await prisma.consultationCondition.createMany({
        data: demo.conditions.map((code) => ({ consultationId: consultation.id, conditionCode: code })),
      })
    }
    if (demo.allergies?.length) {
      await prisma.consultationAllergy.createMany({
        data: demo.allergies.map((allergy) => ({
          consultationId: consultation.id,
          medication: allergy.medication,
          reaction: allergy.reaction,
          ingredientKey: allergy.ingredientKey ?? null,
        })),
      })
    }
    if (demo.medications?.length) {
      await prisma.consultationMedication.createMany({
        data: demo.medications.map((medication) => ({
          consultationId: consultation.id,
          name: medication.name,
          dose: medication.dose ?? null,
          source: 'MANUAL' as never,
          ingredientKey: medication.ingredientKey ?? null,
          unresolved: Boolean(medication.unresolved),
        })),
      })
    }
    if (demo.redFlags?.length) {
      await prisma.consultationRedFlag.createMany({
        data: demo.redFlags.map((flag) => ({
          consultationId: consultation.id,
          code: flag.code,
          label: flag.label,
          severity: flag.severity as never,
          source: flag.source as never,
          evidence: flag.evidence ?? null,
          detectedAt: createdAt,
        })),
      })
    }

    // ── recommendations ──────────────────────────────────────────────────
    let rank = 0
    for (const item of demo.products ?? []) {
      const product = await prisma.product.findUnique({
        where: { sku: item.sku },
        select: {
          id: true,
          name: true,
          price: true,
          discountPrice: true,
          dosageForm: true,
          strength: true,
          packageSize: true,
          activeIngredientsIndex: true,
          category: { select: { name: true } },
          images: { select: { fileKey: true, isPrimary: true }, orderBy: { sortOrder: 'asc' } },
          inventory: { select: { quantity: true, reserved: true } },
          ingredients: { select: { ingredient: { select: { name: true } } } },
        },
      })
      if (!product) continue
      rank += 1

      await prisma.consultationRecommendation.create({
        data: {
          consultationId: consultation.id,
          productId: product.id,
          productName: product.name,
          categoryName: product.category.name,
          activeIngredients:
            product.ingredients.map((i) => i.ingredient.name).join(', ') || product.activeIngredientsIndex,
          dosageForm: product.dosageForm,
          strength: product.strength,
          packageSize: product.packageSize,
          price: product.discountPrice ?? product.price,
          stockQuantity: Math.max(0, (product.inventory?.quantity ?? 0) - (product.inventory?.reserved ?? 0)),
          imageKey: product.images.find((i) => i.isPrimary)?.fileKey ?? product.images[0]?.fileKey ?? null,
          status: item.status as never,
          rank,
          safetyScore: item.safetyScore,
          relevanceScore: 77,
          reason: item.reason || null,
          safetyNotes: item.safetyNotes ?? null,
          interactionStatus: item.interaction as never,
          blockedReason: item.blockedReason ?? null,
          createdAt,
        },
      })
    }

    // ── safety checks ────────────────────────────────────────────────────
    for (const check of demo.safetyChecks ?? []) {
      const product = check.sku
        ? await prisma.product.findUnique({ where: { sku: check.sku }, select: { id: true, name: true } })
        : null
      await prisma.consultationSafetyCheck.create({
        data: {
          consultationId: consultation.id,
          productId: product?.id ?? null,
          productName: product?.name ?? null,
          type: check.type as never,
          outcome: check.outcome as never,
          code: check.code,
          detail: check.detail,
          createdAt,
        },
      })
    }

    // ── audit trail ──────────────────────────────────────────────────────
    const stages: { stage: string; summary: string }[] = [
      { stage: 'consultation_started', summary: `Consultation ${consultation.code} started in ${demo.locale}` },
      { stage: 'consent_accepted', summary: 'Disclaimer disc-2026.08.1 accepted' },
      {
        stage: 'red_flag_screening',
        summary: demo.redFlags?.length
          ? `Red flags: ${demo.redFlags.map((f) => f.code).join(', ')}`
          : 'No red flags detected',
      },
      {
        stage: 'guideline_lookup',
        summary: demo.products?.length ? `Guideline gl-${demo.symptom.replace(/_/g, '-')} applied` : 'No approved guideline applied',
      },
      { stage: 'triage', summary: `Triage ${demo.triage}` },
      {
        stage: 'product_retrieval',
        summary: `${demo.products?.length ?? 0} candidate product(s) inside guideline scope`,
      },
      {
        stage: 'ranking',
        summary: `${(demo.products ?? []).filter((p) => p.status !== 'BLOCKED').length} of ${
          demo.products?.length ?? 0
        } product(s) selected for display`,
      },
      {
        stage: 'safety_validation',
        summary: demo.llmUsed
          ? 'Generated response passed safety validation'
          : 'Deterministic wording used',
      },
      { stage: 'assessment_completed', summary: `${demo.triage} — assessment stored` },
    ]

    await prisma.consultationAuditEntry.createMany({
      data: stages.map((entry, order) => ({
        consultationId: consultation.id,
        stage: entry.stage,
        summary: entry.summary,
        aiModel: demo.llmUsed ? 'claude-opus-5' : null,
        promptVersion: 'cons-prompt-2026.08.1',
        rulesVersion: 'q-2026.08.1|rf-2026.08.1|tri-2026.08.1|ci-2026.08.1|ix-2026.08.1',
        latencyMs: 120 + order * 45,
        createdAt: new Date(createdAt.getTime() + order * 1500),
      })),
    })

    // ── pharmacist review ────────────────────────────────────────────────
    if (demo.review && pharmacist) {
      await prisma.consultationReview.create({
        data: {
          consultationId: consultation.id,
          pharmacistId: pharmacist.id,
          action: demo.review.action as never,
          aiRecommendation: {
            triageLevel: demo.triage,
            products: (demo.products ?? []).map((p) => ({ sku: p.sku, status: p.status })),
            model: demo.llmUsed ? 'claude-opus-5' : null,
          } as never,
          pharmacistRecommendation: demo.review.recommendation ?? null,
          reasonForChange: demo.review.reason ?? null,
          note: demo.review.note ?? null,
          createdAt: new Date(createdAt.getTime() + 3_600_000),
        },
      })
      await prisma.consultationAuditEntry.create({
        data: {
          consultationId: consultation.id,
          stage: 'pharmacist_review',
          summary: `${demo.review.action} by ${pharmacist.fullName}`,
          actorId: pharmacist.id,
          actorLabel: `${pharmacist.fullName} (Фармацевт)`,
          createdAt: new Date(createdAt.getTime() + 3_600_000),
        },
      })
    }

    created += 1
  }

  console.log(`  ✓ ${created} demo consultations`)
}
