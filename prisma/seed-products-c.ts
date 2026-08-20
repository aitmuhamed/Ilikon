import type { SeedProduct } from './seed-products-a'

const L_MN = 'Хэрэглэхээсээ өмнө зааврыг уншиж, эмч, фармацевтаас зөвлөгөө аваарай.'
const L_EN = 'Read the leaflet before use and consult a doctor or pharmacist.'
const L_RU = 'Перед применением прочитайте инструкцию и обратитесь к врачу или фармацевту.'

/** Compact builder for the remaining catalogue — same shape, less repetition. */
function product(input: SeedProduct): SeedProduct {
  return input
}

export const PRODUCTS_C: SeedProduct[] = [
  product({
    sku: 'ILK-MULTI-50', slug: 'multivitamin-complex', barcode: '4820000100220',
    name: 'Мультивитамин комплекс', nameEn: 'Multivitamin complex', nameRu: 'Мультивитаминный комплекс',
    category: 'vitamin', brand: 'nature-s-bounty', manufacturer: 'solgar-inc',
    rx: false, price: 46000, discountPrice: 39000, stock: 95, art: 'vitamin',
    packageSize: '60 шахмал', dosageForm: 'Шахмал', expiryMonths: 29, weightGrams: 190,
    featured: true, soldCount: 268, shelf: 'V-03',
    mn: {
      short: 'A, C, D, E, B бүлгийн витамин, минерал агуулсан нэмэлт.',
      description:
        'Өдөр тутмын хэрэгцээт витамин, минералын хольц агуулсан био нэмэлт бүтээгдэхүүн. Хоолны дэглэмээр витамины хэрэгцээ хүрэлцэхгүй байх үед нэмэлтээр авах зорилготой. Энэ нь эм биш, өвчнийг эмчлэх, сэргийлэх зорилгогүй.',
      ingredients: 'A, C, D3, E, B1, B2, B6, B12, фолийн хүчил, биотин, цайр, магни, сели, төмөр.',
      activeIngredients: 'Витамин A, C, D3, E, B-комплекс, цайр, магни, сели',
      dosage: 'Насанд хүрэгчид: хоногт 1 шахмал. Зөвлөмжийн тунг хэтрүүлэхгүй.',
      usage: 'Хоолны хамт их хэмжээний усаар залгина.',
      warnings:
        'Бусад витамин, био нэмэлттэй хамт хэрэглэвэл тун давхцах эрсдэлтэй — найрлагыг шалгана. Төмөр агуулсан тул төмрийн хуримтлалын эмгэгтэй хүн эмчээс зөвлөгөө авна. Жирэмсэн эх зөвхөн эмчийн зөвлөсөн витамин хэрэглэнэ. Био нэмэлт нь тэнцвэртэй хоолны дэглэмийг орлохгүй.',
      sideEffects: 'Ходоод сөрдөх, шээсний өнгө шаргалтах (B2 витамины улмаас, хэвийн).',
      storage: 'Хуурай, сэрүүн газар, хүүхдийн хүрэхээргүй.',
    },
    en: {
      short: 'Daily vitamin and mineral supplement.',
      description:
        'A food supplement containing a daily blend of vitamins and minerals, intended to complement the diet where intake is insufficient. Not a medicine and not intended to treat or prevent disease.',
      activeIngredients: 'Vitamins A, C, D3, E, B-complex, zinc, magnesium, selenium',
      dosage: 'Adults: one tablet daily. Do not exceed the recommended dose.',
      warnings:
        'Combining with other supplements risks doubling doses — check the labels. Contains iron; seek advice with iron-overload conditions. Pregnant women should take only vitamins advised by their doctor. ' + L_EN,
      storage: 'Store in a cool dry place out of reach of children.',
    },
    ru: {
      short: 'Ежедневный витаминно-минеральный комплекс.',
      description:
        'Пищевая добавка с суточным набором витаминов и минералов для дополнения рациона. Не является лекарством.',
      activeIngredients: 'Витамины A, C, D3, E, группы B, цинк, магний, селен',
      warnings: 'Совместный приём с другими добавками может привести к двойной дозе. Содержит железо. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-ZINC-25', slug: 'zinc-25mg', barcode: '4820000100237',
    name: 'Цайр 25 мг', nameEn: 'Zinc 25 mg', nameRu: 'Цинк 25 мг',
    category: 'darhlaa-demjih', brand: 'solgar', manufacturer: 'solgar-inc',
    rx: false, price: 28000, stock: 124, art: 'vitamin',
    packageSize: '50 шахмал', dosageForm: 'Шахмал', strength: '25 мг',
    expiryMonths: 31, weightGrams: 95, soldCount: 154, shelf: 'V-04',
    mn: {
      short: 'Цайр агуулсан био нэмэлт бүтээгдэхүүн.',
      description:
        'Цайр нь дархлааны хэвийн үйл ажиллагаа, арьс, үс, хумсны эрүүл байдалд шаардлагатай микроэлемент. Хоолны дэглэмээр хүрэлцээгүй тохиолдолд нэмэлтээр авах зорилготой.',
      ingredients: 'Цайрын цитрат (цайр 25 мг-тай тэнцэх), целлюлоз, магнийн стеарат.',
      activeIngredients: 'Цайр (zinc citrate) 25 мг',
      dosage: 'Насанд хүрэгчид: хоногт 1 шахмал, хоолны хамт. Тунг хэтрүүлэхгүй.',
      usage: 'Хоолны дараа усаар залгина. Хоосон ходоодонд хэрэглэвэл дотор муухайрч болно.',
      warnings:
        'Урт хугацаанд их тунгаар хэрэглэвэл зэсийн шимэгдэлт багасах эрсдэлтэй. Антибиотик (тетрациклин, фторхинолон), төмрийн бэлдмэлтэй 2 цагийн зайтай хэрэглэнэ. Жирэмсэн, хөхүүл эх эмчээс зөвлөгөө авна.',
      sideEffects: 'Дотор муухайрах, амны металл өнгө.',
      storage: 'Хуурай, сэрүүн, гэрлээс хамгаалсан газар.',
    },
    en: {
      short: 'Zinc food supplement.',
      description:
        'Zinc is a trace element needed for normal immune function and healthy skin, hair and nails. Intended to complement the diet where intake is insufficient.',
      activeIngredients: 'Zinc (as citrate) 25 mg',
      dosage: 'Adults: one tablet daily with food. Do not exceed the dose.',
      warnings:
        'Prolonged high doses can impair copper absorption. Separate from tetracycline/fluoroquinolone antibiotics and iron supplements by two hours. ' + L_EN,
      storage: 'Store in a cool, dry place away from light.',
    },
    ru: {
      short: 'Пищевая добавка с цинком.',
      description:
        'Цинк — микроэлемент, необходимый для нормальной работы иммунной системы, здоровья кожи, волос и ногтей.',
      activeIngredients: 'Цинк (цитрат) 25 мг',
      warnings: 'Длительный приём высоких доз снижает усвоение меди. Разделяйте с антибиотиками и железом. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-OMEGA3', slug: 'omega-3-1000mg', barcode: '4820000100244',
    name: 'Омега-3 1000 мг', nameEn: 'Omega-3 1000 mg', nameRu: 'Омега-3 1000 мг',
    category: 'vitamin', brand: 'nature-s-bounty', manufacturer: 'solgar-inc',
    rx: false, price: 52000, discountPrice: 44200, stock: 88, art: 'vitamin',
    packageSize: '100 капсул', dosageForm: 'Зөөлөн капсул', strength: '1000 мг',
    expiryMonths: 24, weightGrams: 210, isNew: true, soldCount: 197, shelf: 'V-05',
    mn: {
      short: 'Загасны тосны EPA, DHA агуулсан капсул.',
      description:
        'Омега-3 тосны хүчил (EPA, DHA) агуулсан био нэмэлт бүтээгдэхүүн. Хоолны дэглэмд загас багатай тохиолдолд нэмэлтээр авах зорилготой.',
      ingredients: 'Загасны тос 1000 мг (EPA 180 мг, DHA 120 мг), желатин, глицерин, витамин E.',
      activeIngredients: 'EPA 180 мг, DHA 120 мг',
      dosage: 'Насанд хүрэгчид: хоногт 1-2 капсул, хоолны хамт.',
      usage: 'Хоолны хамт залгина. Хөргөгчинд хадгалбал загасны үнэр багасна.',
      warnings:
        'Цус шингэлэх эм (варфарин, аспирин) хэрэглэдэг хүн эмчид мэдэгдэнэ — цус гоожих хугацаа удаашрах эрсдэлтэй. Мэс заслын 2 долоо хоногийн өмнө эмчээс зөвлөгөө авна. Загас, далайн хүнсэнд харшилтай хүн хэрэглэхгүй.',
      sideEffects: 'Ходоод дүүрэх, загасны үнэртэй хэхрэлт, суулгах.',
      storage: 'Сэрүүн, хуурай газар. Нээсний дараа хөргөгчинд.',
    },
    en: {
      short: 'Fish oil capsules with EPA and DHA.',
      description:
        'A food supplement providing omega-3 fatty acids (EPA and DHA), intended for diets low in oily fish.',
      activeIngredients: 'EPA 180 mg, DHA 120 mg',
      dosage: 'Adults: one to two capsules daily with food.',
      warnings:
        'Tell your doctor if you take blood thinners (warfarin, aspirin) — bleeding time may be prolonged. Seek advice two weeks before surgery. Not for people allergic to fish or seafood. ' + L_EN,
      storage: 'Cool, dry place; refrigerate after opening.',
    },
    ru: {
      short: 'Капсулы рыбьего жира с EPA и DHA.',
      description: 'Пищевая добавка с омега-3 жирными кислотами (EPA и DHA) для рациона с малым количеством рыбы.',
      activeIngredients: 'EPA 180 мг, DHA 120 мг',
      warnings: 'Сообщите врачу, если принимаете антикоагулянты. Не применять при аллергии на рыбу. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-PROBIO', slug: 'probiotic-10-billion', barcode: '4820000100251',
    name: 'Пробиотик 10 тэрбум CFU', nameEn: 'Probiotic 10 billion CFU', nameRu: 'Пробиотик 10 млрд КОЕ',
    category: 'hool-bolovsruulah', brand: 'solgar', manufacturer: 'solgar-inc',
    rx: false, price: 58000, stock: 71, art: 'vitamin',
    packageSize: '30 капсул', dosageForm: 'Капсул', expiryMonths: 14, weightGrams: 85,
    soldCount: 121, shelf: 'V-06',
    mn: {
      short: 'Гэдэсний бичил биетний тэнцвэрт дэмжлэг болох капсул.',
      description:
        'Lactobacillus, Bifidobacterium төрлийн бичил биетэн агуулсан био нэмэлт бүтээгдэхүүн. Антибиотик эмчилгээний дараа, хоол боловсруулах тогтолцооны тав тухгүй байдлын үед нэмэлтээр авах зорилготой.',
      ingredients: 'Lactobacillus acidophilus, L. rhamnosus, Bifidobacterium lactis (нийт 10 тэрбум CFU), инулин, целлюлоз.',
      activeIngredients: 'Lactobacillus acidophilus, L. rhamnosus, Bifidobacterium lactis — 10 тэрбум CFU',
      dosage: 'Насанд хүрэгчид: хоногт 1 капсул. Антибиотиктой хамт хэрэглэвэл 2-3 цагийн зайтай.',
      usage: 'Хоолны өмнө эсвэл хамт усаар залгина.',
      warnings:
        'Дархлаа хямарсан, хүнд өвчтэй, катетер тавьсан хүн эмчийн хяналтгүй хэрэглэхгүй. Халуун, цустай суулгалт байвал эмчид хандана. Хөргөгчинд хадгалах шаардлагыг дагана.',
      sideEffects: 'Эхний хоногуудад гэдэс дүүрэх, хий их болох.',
      storage: 'Хөргөгчинд (2-8°C) хадгалахыг зөвлөнө. Хүүхдийн хүрэхээргүй.',
    },
    en: {
      short: 'Capsules supporting gut microbiota balance.',
      description:
        'A food supplement containing Lactobacillus and Bifidobacterium strains, intended for use after a course of antibiotics or during digestive discomfort.',
      activeIngredients: 'L. acidophilus, L. rhamnosus, B. lactis — 10 billion CFU',
      dosage: 'Adults: one capsule daily. Separate from antibiotics by 2-3 hours.',
      warnings:
        'Not to be used without medical supervision by immunocompromised or seriously ill people, or those with an indwelling catheter. See a doctor for fever or bloody diarrhoea. ' + L_EN,
      storage: 'Refrigeration (2-8°C) recommended. Keep out of reach of children.',
    },
    ru: {
      short: 'Капсулы для поддержки баланса микрофлоры.',
      description:
        'Пищевая добавка со штаммами Lactobacillus и Bifidobacterium — после курса антибиотиков и при дискомфорте пищеварения.',
      activeIngredients: 'L. acidophilus, L. rhamnosus, B. lactis — 10 млрд КОЕ',
      warnings: 'Не применять без контроля врача при иммунодефиците. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-NASAL-SPR', slug: 'saline-nasal-spray', barcode: '4820000100268',
    name: 'Далайн ус хамрын шүршигч', nameEn: 'Sea water nasal spray', nameRu: 'Спрей для носа с морской водой',
    category: 'haniad-tomuu', brand: 'asian-pharma', manufacturer: 'asian-pharma-llc',
    rx: false, price: 14800, stock: 143, art: 'syrup',
    packageSize: '100 мл', dosageForm: 'Хамрын шүршигч', expiryMonths: 25, weightGrams: 145,
    soldCount: 232, shelf: 'B-04',
    mn: {
      short: 'Изотоник далайн ус агуулсан хамар цэвэрлэх шүршигч.',
      description:
        'Изотоник далайн ус агуулсан, хамрын хөндийг цэвэрлэх, чийгшүүлэх зорилготой шүршигч. Ханиад, харшлын үед хамрын хөндийн эмчилгээний дэмжлэг болгон, өдөр тутмын цэвэрлэгээнд хэрэглэнэ. Эм бус, дасалгүй.',
      ingredients: 'Изотоник далайн ус (натрийн хлорид 0.9%), цэвэршүүлсэн ус.',
      activeIngredients: 'Изотоник далайн ус (0.9% NaCl)',
      dosage: 'Насанд хүрэгчид, хүүхэд: нүх тус бүрд 1-2 шүршилт, өдөрт 2-6 удаа.',
      usage: 'Толгойгоо бага зэрэг өшийлгөж, хошуувчийг хамрын нүхэнд хийж шүршинэ. Дараа нь зөөлөн хамраа цэвэрлэнэ.',
      warnings:
        'Шүршигчийг зөвхөн нэг хүн хэрэглэнэ (халдвар дамжуулахгүйн тулд). Хамар хүчтэй битүүрэх, цус гарах, хамрын мэс заслын дараа эмчээс зөвлөгөө авна. Хамрын шинж 10 хоногоос дээш үргэлжилбэл эмчид хандана.',
      sideEffects: 'Хааяа хамрын хөндий шатах мэдрэмж.',
      storage: 'Хэвийн температурт. Нээсний дараа 6 сарын дотор хэрэглэнэ.',
    },
    en: {
      short: 'Isotonic sea water spray for nasal cleansing.',
      description:
        'An isotonic sea water spray to cleanse and moisturise the nasal cavity. Used as supportive care during colds and allergy season and for daily hygiene. Not a medicine; non-habit-forming.',
      activeIngredients: 'Isotonic sea water (0.9% NaCl)',
      dosage: 'Adults and children: 1-2 sprays per nostril, 2-6 times daily.',
      warnings:
        'For single-person use only. Seek advice for severe blockage, nosebleeds, or after nasal surgery. See a doctor if symptoms last beyond 10 days. ' + L_EN,
      storage: 'Room temperature. Use within six months of opening.',
    },
    ru: {
      short: 'Изотонический спрей с морской водой для носа.',
      description:
        'Изотонический спрей морской воды для очищения и увлажнения полости носа при простуде, аллергии и для ежедневной гигиены.',
      activeIngredients: 'Изотоническая морская вода (0,9% NaCl)',
      warnings: 'Только для индивидуального использования. При симптомах дольше 10 дней — к врачу. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-THROAT-LOZ', slug: 'throat-lozenges', barcode: '4820000100275',
    name: 'Хоолойн шимэх шахмал', nameEn: 'Throat lozenges', nameRu: 'Пастилки для горла',
    category: 'haniad-tomuu', brand: 'monos-pharma', manufacturer: 'monos-group',
    rx: false, price: 6800, stock: 188, art: 'pill',
    packageSize: '24 шахмал', dosageForm: 'Шимэх шахмал',
    registrationNo: 'ЭМ-2022/0177', expiryMonths: 23, weightGrams: 55,
    soldCount: 259, shelf: 'B-05',
    mn: {
      short: 'Хоолой сөрдөх, өвдөхөд шимэх шахмал.',
      description:
        'Хоолойн үрэвсэл, сөрдөлт, өвдөлтийн үед хэрэглэх, орон нутгийн үйлчлэлтэй шимэх шахмал. Ментол, эвкалипт агуулна.',
      ingredients: 'Ментол, эвкалиптын тос, чихрийн орлуулагч (изомальт), лимоны хүчил, ургамлын хийц.',
      activeIngredients: 'Ментол, эвкалиптын тос',
      dosage: 'Насанд хүрэгчид: 2-3 цагийн зайтай 1 шахмал, хоногт 8 шахмалаас илүүгүй. 6-аас доош насны хүүхдэд хэрэглэхгүй.',
      usage: 'Шахмалыг амандаа аажим шимнэ. Зажилж, залгихгүй.',
      warnings:
        'Хоолойн өвдөлт 5 хоногоос дээш үргэлжилбэл, өндөр халуун, залгихад бэрхшээлтэй, амьсгал давчдвал эмчид хандана. Бага насны хүүхдэд амьсгалын замд орох эрсдэлтэй тул хэрэглэхгүй. Сахарын шижинтэй хүн найрлагыг шалгана. ' + L_MN,
      sideEffects: 'Хааяа ам, хоолой цочрох, дотор муухайрах.',
      storage: '25°C-аас доош, хуурай газар.',
    },
    en: {
      short: 'Lozenges for a sore or irritated throat.',
      description:
        'Locally acting lozenges for sore throat and throat irritation, containing menthol and eucalyptus.',
      activeIngredients: 'Menthol, eucalyptus oil',
      dosage: 'Adults: one lozenge every 2-3 hours, maximum eight per day. Not for children under 6.',
      warnings:
        'See a doctor if the sore throat lasts more than five days or comes with high fever, difficulty swallowing or breathlessness. A choking hazard for small children. Contains sweetener — check if you have diabetes. ' + L_EN,
      storage: 'Store below 25°C in a dry place.',
    },
    ru: {
      short: 'Пастилки при боли и раздражении в горле.',
      description: 'Пастилки местного действия при боли и раздражении в горле, с ментолом и эвкалиптом.',
      activeIngredients: 'Ментол, масло эвкалипта',
      warnings: 'При боли дольше пяти дней, высокой температуре или затруднении глотания — к врачу. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-GLUCO-MTR', slug: 'glucometer-starter-kit', barcode: '4820000100282',
    name: 'Глюкометр багц', nameEn: 'Glucometer starter kit', nameRu: 'Глюкометр — стартовый набор',
    category: 'eruul-mendiin-heregsel', brand: 'beurer', manufacturer: 'beurer-gmbh',
    rx: false, price: 96000, discountPrice: 84000, stock: 27, art: 'device',
    packageSize: '1 багц (25 тууз)', dosageForm: 'Хэмжих хэрэгсэл',
    expiryMonths: 40, weightGrams: 290, soldCount: 43, shelf: 'D-02', lowStockThreshold: 6,
    mn: {
      short: 'Цусан дахь сахарын хэмжээг гэртээ хэмжих багц.',
      description:
        'Гэрийн нөхцөлд цусан дахь глюкозын хэмжээг хэмжих багц. Хэрэгсэл, 25 хэмжих тууз, хатгуур, хатгуурын үзүүр, хадгалах гэр агуулна. Хэмжилтийн үр дүнг тайлбарлах, эмчилгээ тохируулах нь зөвхөн эмчийн үүрэг.',
      ingredients: 'Глюкометр, 25 тест тууз, хатгуурын хэрэгсэл, 25 ланцет, батарей, гэр, заавар.',
      activeIngredients: '—',
      dosage: 'Хэмжилтийн давтамжийг эмч тогтооно (ихэвчлэн хоолны өмнө, дараа).',
      usage:
        'Гараа савантай усаар угааж, сайтар хатаана. Туузыг хэрэгсэлд хийж, хуруунаас цусны дуслыг авна. Ланцетыг зөвхөн нэг удаа хэрэглэнэ.',
      warnings:
        'Хэмжилтийн үзүүлэлтэд тулгуурлан эмийн тунг өөрөө өөрчлөхгүй — зөвхөн эмчийн зааврын дагуу. Хэт бага (гипогликеми) эсвэл хэт өндөр үзүүлэлт гарвал, ухаан бүрхэгших, чичрэх, гүжрэх шинж дагалдвал яаралтай эмнэлэгт хандана. Тест туузны хугацааг шалгаж, хугацаа дууссан туузыг хэрэглэхгүй.',
      sideEffects: 'Хатгасан хэсэгт өвдөлт, цухуйлт.',
      storage: 'Хуурай, 10-30°C. Тест туузыг эх саванд, чийгнээс хамгаална.',
    },
    en: {
      short: 'Home blood glucose testing kit.',
      description:
        'A kit for measuring blood glucose at home. Includes the meter, 25 test strips, a lancing device, lancets and a case. Interpreting the readings and adjusting treatment is the doctor’s role.',
      activeIngredients: '—',
      dosage: 'Testing frequency is set by your doctor (commonly before and after meals).',
      warnings:
        'Never change your medicine dose based on a reading alone — follow your doctor’s instructions. Seek urgent care for very low or very high readings, or with confusion, shaking or drowsiness. Do not use expired test strips. ' + L_EN,
      storage: 'Dry, 10-30°C. Keep strips in their original container away from moisture.',
    },
    ru: {
      short: 'Набор для измерения глюкозы крови дома.',
      description:
        'Набор для измерения глюкозы крови дома: прибор, 25 тест-полосок, ручка для прокола, ланцеты, чехол.',
      activeIngredients: '—',
      warnings:
        'Не меняйте дозу лекарств самостоятельно по показаниям прибора. При очень низких или высоких значениях — срочно к врачу. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-CHICCO-BTL', slug: 'chicco-baby-bottle-250ml', barcode: '4820000100299',
    name: 'Chicco хүүхдийн хөхүүр 250 мл', nameEn: 'Chicco baby bottle 250 ml', nameRu: 'Бутылочка Chicco 250 мл',
    category: 'huuhdiin-buteegdehuun', brand: 'chicco', manufacturer: 'artsana-chicco',
    rx: false, price: 34000, stock: 54, art: 'baby',
    packageSize: '250 мл', dosageForm: 'Хөхүүр', expiryMonths: 48, weightGrams: 130,
    soldCount: 78, shelf: 'E-01',
    mn: {
      short: 'BPA-гүй, анатомийн хөхтэй хүүхдийн хөхүүр.',
      description:
        'BPA агуулаагүй, анатомийн хэлбэртэй силикон хөхтэй хүүхдийн хөхүүр. Хий залгихыг багасгах хавхлагтай. Стерилжүүлэгч, микровэйв, халуун усанд стерилжүүлэхэд тохиромжтой.',
      ingredients: 'Полипропилен шил (BPA-гүй), силикон хөх, полипропилен бүрхүүл.',
      activeIngredients: '—',
      dosage: '—',
      usage:
        'Анх хэрэглэхээсээ өмнө 5 минут буцалсан усанд стерилжүүлнэ. Хэрэглэх бүрд угааж, стерилжүүлнэ. Хөхийг 2 сар тутам, эсвэл гэмтвэл шинээр сольж байна.',
      warnings:
        'Хүүхдийг хөхүүртэй нь хэвтүүлэн орхихгүй (гүлдгэх, шүд цоорох эрсдэл). Шингэний халуунаа гарын дотор талд шалгана — микровэйвээр халаахад тэгш биш халалт үүсдэг. Хөх урагдаж, зурагдсан бол шууд сольж хэрэглэхээ болино.',
      sideEffects: '—',
      storage: 'Цэвэр, хуурай газар. Хэт өндөр температураас хамгаална.',
    },
    en: {
      short: 'BPA-free baby bottle with anatomical teat.',
      description:
        'A BPA-free baby bottle with an anatomically shaped silicone teat and an anti-colic valve. Suitable for steriliser, microwave and hot-water sterilisation.',
      activeIngredients: '—',
      dosage: '—',
      warnings:
        'Never leave a baby lying down with the bottle (choking and tooth decay risk). Check the liquid temperature on the inside of your wrist — microwaves heat unevenly. Replace the teat if it is torn or scratched. ' + L_EN,
      storage: 'Keep clean and dry, away from excessive heat.',
    },
    ru: {
      short: 'Бутылочка без BPA с анатомической соской.',
      description:
        'Бутылочка без BPA с анатомической силиконовой соской и антиколиковым клапаном. Подходит для стерилизатора и микроволновки.',
      activeIngredients: '—',
      warnings:
        'Не оставляйте ребёнка лежащим с бутылочкой. Проверяйте температуру на внутренней стороне запястья. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-BABY-CREAM', slug: 'huuhdiin-tos-100ml', barcode: '4820000100305',
    name: 'Хүүхдийн арчилгааны тос 100 мл', nameEn: 'Baby care cream 100 ml', nameRu: 'Детский крем 100 мл',
    category: 'huuhdiin-buteegdehuun', brand: 'nivea', manufacturer: 'beiersdorf-ag',
    rx: false, price: 16500, stock: 116, art: 'baby',
    packageSize: '100 мл', dosageForm: 'Тос', expiryMonths: 28, weightGrams: 125,
    soldCount: 143, shelf: 'E-02',
    mn: {
      short: 'Нярай, бага насны хүүхдийн арьсанд зориулсан тос.',
      description:
        'Нярай, бага насны хүүхдийн эмзэг арьсанд зориулсан, үнэргүй чийгшүүлэх тос. Хөхүүрийн даавуунаас үүдэх арьсны цочролыг хөнгөвчлөх, чийгийн хамгаалалт дэмжих зорилготой. Парабен, будаггүй.',
      ingredients: 'Ус, пантенол, цайрын оксид, глицерин, аммоны хайлмал, витамин E.',
      activeIngredients: 'Пантенол, цайрын оксид',
      dosage: '—',
      usage: 'Арьсыг цэвэрлэж, хатаасны дараа нимгэн тавьж түрхэнэ. Даавуу солих бүрд хэрэглэж болно.',
      warnings:
        'Зөвхөн гадуур хэрэглэнэ. Нүд, амны эргэн тойронд хэрэглэхээс сэрэмжлэнэ. Арьс улайх, цэврүүтэх, шүүрэлтэй болвол хэрэглэхээ зогсоож эмчид хандана — халдварын шинж байж болно. Нээлттэй шарх, түлэгдэлтэд хэрэглэхгүй.',
      sideEffects: 'Хааяа арьсны мэдрэмтгий шинж.',
      storage: 'Хэвийн температурт, нарнаас хамгаална.',
    },
    en: {
      short: 'Cream for newborn and infant skin.',
      description:
        'A fragrance-free moisturising cream for the delicate skin of newborns and infants, intended to soothe nappy-related irritation and support the skin barrier. Free from parabens and colourants.',
      activeIngredients: 'Panthenol, zinc oxide',
      dosage: '—',
      warnings:
        'External use only. Avoid the eyes and mouth. Stop use and see a doctor if the skin becomes red, blistered or weeping — this can indicate infection. Do not apply to open wounds or burns. ' + L_EN,
      storage: 'Room temperature, away from sunlight.',
    },
    ru: {
      short: 'Крем для кожи новорождённых и малышей.',
      description:
        'Увлажняющий крем без ароматизаторов для нежной кожи новорождённых и малышей, при раздражении от подгузников.',
      activeIngredients: 'Пантенол, оксид цинка',
      warnings: 'Только наружно. При покраснении, пузырьках или отделяемом — к врачу. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-PRENATAL', slug: 'prenatal-vitamin', barcode: '4820000100312',
    name: 'Жирэмсний витамин (фолийн хүчилтэй)', nameEn: 'Prenatal vitamin with folic acid', nameRu: 'Витамины для беременных с фолиевой кислотой',
    category: 'ehiin-buteegdehuun', brand: 'solgar', manufacturer: 'solgar-inc',
    rx: false, price: 62000, stock: 49, art: 'vitamin',
    packageSize: '60 шахмал', dosageForm: 'Шахмал', expiryMonths: 26, weightGrams: 175,
    soldCount: 87, shelf: 'V-07',
    mn: {
      short: 'Жирэмсэн, төлөвлөж байгаа эхэд зориулсан витамины нэмэлт.',
      description:
        'Фолийн хүчил, төмөр, кальци, B бүлгийн витамин агуулсан, жирэмсэн болон жирэмслэхээр төлөвлөж байгаа эхэд зориулсан био нэмэлт бүтээгдэхүүн. Хэрэглэх эсэх, тунг эмч эсвэл эх барихын мэргэжилтэн тодорхойлно.',
      ingredients: 'Фолийн хүчил 400 мкг, төмөр 18 мг, кальци, D3, B6, B12, иод, магни.',
      activeIngredients: 'Фолийн хүчил 400 мкг, төмөр 18 мг, D3, B12, иод',
      dosage: 'Хоногт 1 шахмал, хоолны хамт. Тунг эмчээс тодруулна.',
      usage: 'Хоолны хамт усаар залгина. Хоосон ходоодонд хэрэглэвэл дотор муухайрч болно.',
      warnings:
        'Жирэмсний үеийн ямар ч нэмэлт бүтээгдэхүүнийг эмчийн зөвлөгөөгүй хэрэглэхгүй. Бусад витамин, төмрийн бэлдмэлтэй хамт хэрэглэвэл тун хэтрэх эрсдэлтэй — эмчид мэдэгдэнэ. A витамины хэлбэр, тунд онцгой анхаарна (retinol өндөр тун жирэмсний үед зохимжгүй). Төмөр агуулсан бэлдмэлийг хүүхдийн хүрэхээргүй хадгална (хэт тун нь хүүхдэд онцгой хортой).',
      sideEffects: 'Дотор муухайрах, өтгөн хатах, баасны өнгө хартах (төмрийн улмаас, хэвийн).',
      storage: 'Хуурай, сэрүүн газар. Хүүхдийн хүрэхээргүй.',
    },
    en: {
      short: 'Supplement for pregnancy and preconception.',
      description:
        'A food supplement with folic acid, iron, calcium and B vitamins for women who are pregnant or planning pregnancy. Whether to take it, and at what dose, is decided by a doctor or midwife.',
      activeIngredients: 'Folic acid 400 mcg, iron 18 mg, D3, B12, iodine',
      dosage: 'One tablet daily with food. Confirm the dose with your doctor.',
      warnings:
        'Do not take any supplement in pregnancy without medical advice. Combining with other vitamins or iron risks excess intake — tell your doctor. Pay particular attention to the form and dose of vitamin A. Keep iron-containing products well out of reach of children — overdose is especially dangerous for them. ' + L_EN,
      storage: 'Cool, dry place, out of reach of children.',
    },
    ru: {
      short: 'Добавка для беременности и подготовки к ней.',
      description:
        'Пищевая добавка с фолиевой кислотой, железом, кальцием и витаминами группы B для беременных и планирующих беременность. Решение о приёме принимает врач.',
      activeIngredients: 'Фолиевая кислота 400 мкг, железо 18 мг, D3, B12, йод',
      warnings:
        'Не принимайте добавки при беременности без назначения врача. Храните вдали от детей — передозировка железа особенно опасна. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-HAND-SAN', slug: 'hand-sanitiser-500ml', barcode: '4820000100329',
    name: 'Гар халдваргүйжүүлэгч 500 мл', nameEn: 'Hand sanitiser 500 ml', nameRu: 'Антисептик для рук 500 мл',
    category: 'ariun-tsevriin-buteegdehuun', brand: 'asian-pharma', manufacturer: 'asian-pharma-llc',
    rx: false, price: 11500, discountPrice: 9200, stock: 236, art: 'hygiene',
    packageSize: '500 мл', dosageForm: 'Гель', expiryMonths: 22, weightGrams: 540,
    soldCount: 318, shelf: 'H-01',
    mn: {
      short: '70% спиртийн гель, гарын халдваргүйжүүлэлтэд.',
      description:
        '70% этилийн спирт агуулсан, гарыг хурдан халдваргүйжүүлэх гель. Глицерин агуулсан тул арьс хатах нь багасна. Гар угаах боломжгүй үед хэрэглэхэд зохимжтой.',
      ingredients: 'Этанол 70% (v/v), глицерин, карбомер, цэвэршүүлсэн ус.',
      activeIngredients: 'Этанол 70%',
      dosage: '—',
      usage:
        '3-5 мл гелийг хуурай гартаа хийж, хуруу хоорондоо, хурууны үзүүр, хумсны эргэн тойрныг 20-30 секунд сайтар үрнэ. Хатах хүртэл арчихгүй.',
      warnings:
        'Гал авалцах эрсдэлтэй — галаас хол байлга. Зөвхөн гадуур хэрэглэнэ, залгихгүй. Хүүхдийн хүрэхээргүй байлга (залгих нь хүнд хордлого үүсгэнэ). Нүдэнд орвол их хэмжээний усаар зайлна. Илэрхий бохирдсон гарыг эхлээд савантай усаар угаана — спирт бохирдлыг цэвэрлэдэггүй.',
      sideEffects: 'Арьс хатах, цархирах. Гэмтсэн арьсанд шатах мэдрэмж.',
      storage: '25°C-аас доош, галаас хол, битүү тагтай.',
    },
    en: {
      short: '70% alcohol gel for hand disinfection.',
      description:
        'A hand gel containing 70% ethanol for rapid disinfection, with glycerin to reduce skin drying. Suited to situations where hand washing is not possible.',
      activeIngredients: 'Ethanol 70%',
      dosage: '—',
      warnings:
        'Flammable — keep away from flame. External use only, do not swallow. Keep out of reach of children (ingestion causes serious poisoning). Rinse thoroughly if it enters the eyes. Visibly soiled hands must be washed with soap first — alcohol does not clean dirt. ' + L_EN,
      storage: 'Below 25°C, away from flame, tightly closed.',
    },
    ru: {
      short: 'Гель с 70% спирта для дезинфекции рук.',
      description:
        'Гель с 70% этанола для быстрой дезинфекции рук, с глицерином против сухости кожи.',
      activeIngredients: 'Этанол 70%',
      warnings:
        'Горюче — держите вдали от огня. Только наружно, не проглатывать. Храните вдали от детей. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-MASK-50', slug: 'medical-mask-50pcs', barcode: '4820000100336',
    name: 'Эмнэлгийн маск (50 шх)', nameEn: 'Medical face mask (50 pcs)', nameRu: 'Медицинская маска (50 шт)',
    category: 'ariun-tsevriin-buteegdehuun', brand: 'hartmann', manufacturer: 'paul-hartmann',
    rx: false, price: 12000, stock: 302, art: 'hygiene',
    packageSize: '50 шх', dosageForm: 'Нэг удаагийн маск', expiryMonths: 36, weightGrams: 210,
    soldCount: 405, shelf: 'H-02',
    mn: {
      short: 'Гурван үе бүхий нэг удаагийн эмнэлгийн маск.',
      description:
        'Гурван үе бүхий, шүүлтүүртэй нэг удаагийн эмнэлгийн маск. Хамрын хэлбэржүүлэх төмөр, тэлэх резинэн оосортой. Ханиад, томуугийн үед бусдад дусал дамжуулах эрсдэлийг багасгах, тоос, хүйтэн агаараас хамгаалахад хэрэглэнэ.',
      ingredients: 'Спанбонд гадна үе, мелтблоун шүүлтүүр, спанбонд дотор үе, хамрын хэлбэржүүлэгч, эластик оосор.',
      activeIngredients: '—',
      dosage: '—',
      usage:
        'Гараа цэвэрлээд, өнгөт тал гадагш харуулж, хамар, ам, шаналыг бүрэн хучина. Хамрын хэлбэржүүлэгчийг хамрын хэлбэрт тааруулна. Маскийг оосроос авч тайлж, гараа дахин цэвэрлэнэ.',
      warnings:
        'Нэг удаагийн бүтээгдэхүүн — угааж, дахин хэрэглэхгүй. Норсон, бохирдсон, гэмтсэн маскийг шууд сольно (4 цаг хүртэл хэрэглэхийг зөвлөнө). Маск нь бүрэн хамгаалалт биш — гар угаах, зай барих зэрэг бусад арга хэмжээг үргэлжлүүлнэ. Амьсгалын хүнд эмгэгтэй хүн эмчээс зөвлөгөө авна.',
      sideEffects: 'Урт хугацаанд зүүвэл арьс цочрох, амьсгалахад тав тухгүй байдал.',
      storage: 'Хуурай, цэвэр газар, эх савлагаанд.',
    },
    en: {
      short: 'Three-layer disposable medical face mask.',
      description:
        'A three-layer disposable medical mask with a filter layer, nose wire and elastic ear loops. Used to reduce droplet spread during colds and flu, and as protection from dust and cold air.',
      activeIngredients: '—',
      dosage: '—',
      warnings:
        'Single use — do not wash and reuse. Replace immediately when damp, soiled or damaged (up to four hours of use is recommended). A mask is not complete protection — continue hand washing and distancing. People with severe respiratory conditions should seek advice. ' + L_EN,
      storage: 'Keep clean and dry in the original packaging.',
    },
    ru: {
      short: 'Трёхслойная одноразовая медицинская маска.',
      description:
        'Трёхслойная одноразовая медицинская маска с фильтрующим слоем, носовым фиксатором и эластичными петлями.',
      activeIngredients: '—',
      warnings:
        'Одноразовое изделие — не стирать и не использовать повторно. Меняйте при намокании или загрязнении. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-SPF50', slug: 'sunscreen-spf50', barcode: '4820000100343',
    name: 'Нарны хамгаалалт SPF 50+', nameEn: 'Sunscreen SPF 50+', nameRu: 'Солнцезащитный крем SPF 50+',
    category: 'goo-saihan', brand: 'bioderma', manufacturer: 'naos-bioderma',
    rx: false, price: 74000, discountPrice: 62900, stock: 41, art: 'cosmetic',
    packageSize: '40 мл', dosageForm: 'Тос', expiryMonths: 30, weightGrams: 60,
    isNew: true, soldCount: 66, shelf: 'C-06',
    mn: {
      short: 'Нүүрний өндөр хамгаалалттай нарны тос.',
      description:
        'UVA/UVB-ийн өндөр хамгаалалттай (SPF 50+) нүүрний тос. Тослог бус бүтэц, цагаан ул мөр үлдээхгүй. Уулын нар, цасны тусгал их Монголын нөхцөлд өдөр тутмын хамгаалалтад тохиромжтой.',
      ingredients: 'Ус, нарны шүүлтүүрийн систем (UVA/UVB), глицерин, витамин E, лаурил метикрилат копольмер.',
      activeIngredients: 'Өргөн хүрээний UVA/UVB шүүлтүүр (SPF 50+)',
      dosage: '—',
      usage:
        'Нар гарахаас 20 минутын өмнө нүүр, хүзүүнд өгөөмөр түрхэнэ. 2 цаг тутам, хөлс их гарсан, усанд орсны дараа шинээр түрхэнэ.',
      warnings:
        'Нарны тос нь нарны хортой нөлөөнөөс бүрэн хамгаалахгүй — нарны хамгийн хүчтэй цагт (11:00-16:00) сүүдэрт байх, малгай, нүдний шил хэрэглэхийг зөвлөнө. Нярай, 6 сараас доош насны хүүхдэд нарны тос биш, шууд нарнаас хамгаалах арга хэрэглэнэ. Нүдэнд орохоос сэрэмжлэнэ.',
      sideEffects: 'Хааяа арьс улайх, цархирах.',
      storage: 'Хэвийн температурт, шууд наранд, өндөр халуунд тавихгүй.',
    },
    en: {
      short: 'High-protection facial sunscreen.',
      description:
        'A facial sunscreen with high UVA/UVB protection (SPF 50+). Non-greasy texture, leaves no white cast. Suited to daily protection in Mongolia’s high-altitude sun and snow glare.',
      activeIngredients: 'Broad-spectrum UVA/UVB filters (SPF 50+)',
      dosage: '—',
      warnings:
        'Sunscreen does not fully protect against sun damage — seek shade between 11:00 and 16:00 and wear a hat and sunglasses. For infants under six months, use physical shade rather than sunscreen. Avoid contact with the eyes. ' + L_EN,
      storage: 'Room temperature; keep out of direct sun and high heat.',
    },
    ru: {
      short: 'Солнцезащитный крем для лица высокой защиты.',
      description:
        'Солнцезащитный крем для лица с высокой защитой UVA/UVB (SPF 50+). Не жирная текстура, без белых следов.',
      activeIngredients: 'Фильтры широкого спектра UVA/UVB (SPF 50+)',
      warnings:
        'Крем не защищает полностью — ищите тень с 11:00 до 16:00, носите головной убор и очки. ' + L_RU,
    },
  }),
  product({
    sku: 'ILK-MAGB6', slug: 'magnesium-b6', barcode: '4820000100350',
    name: 'Магни B6', nameEn: 'Magnesium B6', nameRu: 'Магний B6',
    category: 'vitamin', brand: 'sandoz', manufacturer: 'sandoz-gmbh',
    rx: false, price: 31000, stock: 103, art: 'vitamin',
    packageSize: '50 шахмал', dosageForm: 'Бүрсэн шахмал', expiryMonths: 27, weightGrams: 110,
    soldCount: 173, shelf: 'V-08',
    mn: {
      short: 'Магни, B6 витамин агуулсан нэмэлт.',
      description:
        'Магни, B6 витамин агуулсан био нэмэлт бүтээгдэхүүн. Магни нь булчин, мэдрэлийн системийн хэвийн үйл ажиллагаанд шаардлагатай минерал. Хоолны дэглэмээр хүрэлцээгүй тохиолдолд нэмэлтээр авах зорилготой.',
      ingredients: 'Магнийн лактат (магни 48 мг), пиридоксин гидрохлорид (B6) 5 мг, целлюлоз, магнийн стеарат.',
      activeIngredients: 'Магни 48 мг, витамин B6 5 мг',
      dosage: 'Насанд хүрэгчид: хоногт 2-3 шахмал, хуваан хэрэглэнэ. Тунг эмчээс тодруулна.',
      usage: 'Хоолны хамт их хэмжээний усаар залгина.',
      warnings:
        'Бөөрний хүнд дутагдалтай хүн хэрэглэхгүй — магни хуримтлагдана. Тетрациклин, бисфосфонат зэрэг эмтэй 2-3 цагийн зайтай хэрэглэнэ. B6 витаминыг урт хугацаанд их тунгаар хэрэглэвэл мэдрэлийн гаж нөлөө гарах эрсдэлтэй тул зөвлөмжийн тунг баримтална. Жирэмсэн, хөхүүл эх эмчээс зөвлөгөө авна.',
      sideEffects: 'Суулгах, ходоод сөрдөх.',
      storage: 'Хуурай, 25°C-аас доош газар.',
    },
    en: {
      short: 'Magnesium and vitamin B6 supplement.',
      description:
        'A food supplement with magnesium and vitamin B6. Magnesium is a mineral needed for normal muscle and nervous system function; intended to complement the diet where intake is insufficient.',
      activeIngredients: 'Magnesium 48 mg, vitamin B6 5 mg',
      dosage: 'Adults: two to three tablets daily in divided doses. Confirm with a doctor.',
      warnings:
        'Not for people with severe kidney failure — magnesium accumulates. Separate from tetracyclines and bisphosphonates by 2-3 hours. Prolonged high-dose B6 risks nerve side effects, so keep to the recommended dose. ' + L_EN,
      storage: 'Dry place below 25°C.',
    },
    ru: {
      short: 'Добавка с магнием и витамином B6.',
      description:
        'Пищевая добавка с магнием и витамином B6. Магний необходим для нормальной работы мышц и нервной системы.',
      activeIngredients: 'Магний 48 мг, витамин B6 5 мг',
      warnings:
        'Не применять при тяжёлой почечной недостаточности. Разделяйте с тетрациклинами и бисфосфонатами. ' + L_RU,
    },
  }),
]
