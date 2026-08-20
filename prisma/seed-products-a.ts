export interface SeedProduct {
  sku: string
  slug: string
  barcode: string
  name: string
  nameEn: string
  nameRu: string
  category: string
  brand: string
  manufacturer: string
  rx: boolean
  controlled?: boolean
  price: number
  discountPrice?: number
  costPrice?: number
  stock: number
  lowStockThreshold?: number
  art: string
  packageSize: string
  dosageForm: string
  strength?: string
  registrationNo?: string
  /** Months from seed date until the earliest batch expires. */
  expiryMonths: number
  weightGrams?: number
  featured?: boolean
  isNew?: boolean
  soldCount?: number
  shelf?: string
  mn: {
    short: string
    description: string
    ingredients: string
    activeIngredients: string
    dosage: string
    usage: string
    warnings: string
    sideEffects: string
    storage: string
  }
  en: {
    short: string
    description: string
    activeIngredients: string
    dosage: string
    warnings: string
    storage: string
  }
  ru: {
    short: string
    description: string
    activeIngredients: string
    warnings: string
  }
}

const LEAFLET_MN =
  'Хэрэглэхээсээ өмнө хайрцган дахь зааврыг бүрэн уншиж, эмч, фармацевтаас зөвлөгөө аваарай.'
const LEAFLET_EN =
  'Read the full package leaflet before use and consult a doctor or pharmacist.'
const LEAFLET_RU =
  'Перед применением полностью прочитайте инструкцию и обратитесь к врачу или фармацевту.'

export const PRODUCTS_A: SeedProduct[] = [
  {
    sku: 'ILK-PAR-500', slug: 'paracetamol-500mg', barcode: '4820000100015',
    name: 'Парацетамол 500 мг', nameEn: 'Paracetamol 500 mg', nameRu: 'Парацетамол 500 мг',
    category: 'uvdult-namdaah', brand: 'monos-pharma', manufacturer: 'monos-group',
    rx: false, price: 3500, stock: 240, art: 'pill',
    packageSize: '20 шахмал', dosageForm: 'Шахмал', strength: '500 мг',
    registrationNo: 'ЭМ-2021/0142', expiryMonths: 26, weightGrams: 30,
    featured: true, soldCount: 412, shelf: 'A-01',
    mn: {
      short: 'Өвдөлт намдаах, халуун бууруулах жоргүй шахмал.',
      description:
        'Парацетамол нь өвдөлт намдаах, халуун бууруулах зорилгоор өргөн хэрэглэгддэг үйлчлэгч бодис юм. Толгой өвдөх, шүд өвдөх, булчин ба үений өвдөлт, ханиад томуутай холбоотой халууралтын үед хэрэглэх заавартай. Ходоодны хананд харьцангуй бага үйлчилдэг тул хоолны дараа болон хооллохгүйгээр хэрэглэх боломжтой.',
      ingredients: 'Парацетамол 500 мг, микрокристалл целлюлоз, повидон, магнийн стеарат, кросповидон.',
      activeIngredients: 'Парацетамол (paracetamol) 500 мг',
      dosage:
        'Насанд хүрэгчид: нэг удаад 500-1000 мг, 4-6 цагийн зайтай. Хоногт 4 г-аас хэтрүүлэхгүй. Хүүхдийн тун жин, наснаас хамаарна — фармацевт, эмчээс тодруулна уу.',
      usage: 'Ханхалсан их хэмжээний шүүсгүй, дулаан усаар бүтнээр залгина. Шахмалыг хагалж, чихрийг зажлахгүй.',
      warnings:
        'Элэгний эмгэг, архидан хэрэглэлт, парацетамолд харшилтай хүн хэрэглэхгүй. Парацетамол агуулсан бусад эмтэй хамт хэрэглэвэл тун хэтрэх эрсдэлтэй — хайрцган дээрх найрлагыг шалгаарай. Жирэмсэн, хөхүүл эх, 12-аас доош насны хүүхэд хэрэглэхээсээ өмнө эмчид хандана. ' + LEAFLET_MN,
      sideEffects:
        'Хааяа арьсны тууралт, дотор муухайрах. Их тунгаар удаан хэрэглэвэл элэгний эмгэг үүсэх эрсдэлтэй. Гаж нөлөө мэдэгдвэл хэрэглэхээ зогсоож эмчид хандана уу.',
      storage: '25°C-аас доош, гэрэл, чийгнээс хамгаалж, хүүхдийн хүрэхээргүй газар хадгална.',
    },
    en: {
      short: 'Over-the-counter tablet for pain and fever.',
      description:
        'Paracetamol is a widely used analgesic and antipyretic. It is indicated for headache, toothache, muscle and joint pain, and fever associated with colds and flu. It is comparatively gentle on the stomach lining and can be taken with or without food.',
      activeIngredients: 'Paracetamol 500 mg',
      dosage:
        'Adults: 500-1000 mg per dose every 4-6 hours. Do not exceed 4 g in 24 hours. Paediatric dosing depends on weight and age — ask a pharmacist or doctor.',
      warnings:
        'Not for people with liver disease, chronic alcohol use, or paracetamol allergy. Taking it alongside other paracetamol-containing products risks an overdose — check the labels. Pregnant or breastfeeding women and children under 12 should consult a doctor first. ' + LEAFLET_EN,
      storage: 'Store below 25°C, protected from light and moisture, out of reach of children.',
    },
    ru: {
      short: 'Безрецептурные таблетки от боли и жара.',
      description:
        'Парацетамол — широко применяемое обезболивающее и жаропонижающее средство. Показан при головной и зубной боли, боли в мышцах и суставах, при повышенной температуре на фоне простуды и гриппа.',
      activeIngredients: 'Парацетамол 500 мг',
      warnings:
        'Не применять при заболеваниях печени, хроническом употреблении алкоголя, аллергии на парацетамол. Одновременный приём других средств с парацетамолом опасен передозировкой. ' + LEAFLET_RU,
    },
  },
  {
    sku: 'ILK-IBU-400', slug: 'ibuprofen-400mg', barcode: '4820000100022',
    name: 'Ибупрофен 400 мг', nameEn: 'Ibuprofen 400 mg', nameRu: 'Ибупрофен 400 мг',
    category: 'uvdult-namdaah', brand: 'krka', manufacturer: 'krka-dd',
    rx: false, price: 7800, discountPrice: 6600, stock: 165, art: 'pill',
    packageSize: '20 шахмал', dosageForm: 'Бүрсэн шахмал', strength: '400 мг',
    registrationNo: 'ЭМ-2020/0331', expiryMonths: 22, weightGrams: 34,
    featured: true, soldCount: 356, shelf: 'A-02',
    mn: {
      short: 'Үрэвслийн эсрэг, өвдөлт намдаах шахмал.',
      description:
        'Ибупрофен нь стероид бус үрэвслийн эсрэг эмийн (NSAID) бүлэгт хамаарна. Толгой өвдөх, шүд өвдөх, сарын тэмдгийн үеийн өвдөлт, булчин, үений өвдөлт, халууралтын үед хэрэглэх заавартай.',
      ingredients: 'Ибупрофен 400 мг, лактоз монохидрат, кроскармеллоз натри, гипромеллоз, титан диоксид.',
      activeIngredients: 'Ибупрофен (ibuprofen) 400 мг',
      dosage:
        'Насанд хүрэгчид: нэг удаад 200-400 мг, 6-8 цагийн зайтай. Хоногт 1200 мг-аас хэтрүүлэхгүй. Хамгийн бага үр дүнтэй тунг хамгийн бага хугацаанд хэрэглэнэ.',
      usage: 'Ходоодыг хамгаалахын тулд хоолны дараа, их хэмжээний усаар залгина.',
      warnings:
        'Ходоод, гэдэсний шархлаа, цус гоожилт, зүрх-судас, бөөрний эмгэгтэй хүн эмчийн зөвлөгөөгүй хэрэглэхгүй. Аспирин, бусад NSAID-д харшилтай, астматай хүн онцгой сэрэмжтэй. Жирэмсний 3 дахь гурван сард хэрэглэхийг хориглоно. ' + LEAFLET_MN,
      sideEffects: 'Ходоод дээгүүр өвдөх, дотор муухайрах, толгой эргэх, арьсны тууралт. Хар өнгийн бааж, цус хаях зэрэг тохиолдолд шууд эмчид хандана.',
      storage: '25°C-аас доош, хуурай, гэрлээс хамгаалсан газар хадгална.',
    },
    en: {
      short: 'Anti-inflammatory painkiller tablet.',
      description:
        'Ibuprofen is a non-steroidal anti-inflammatory drug (NSAID) indicated for headache, toothache, period pain, muscle and joint pain, and fever.',
      activeIngredients: 'Ibuprofen 400 mg',
      dosage:
        'Adults: 200-400 mg per dose every 6-8 hours, maximum 1200 mg in 24 hours. Use the lowest effective dose for the shortest time.',
      warnings:
        'Not to be taken without medical advice by people with stomach or intestinal ulcers, bleeding disorders, cardiovascular or kidney disease. Caution with aspirin/NSAID allergy and asthma. Contraindicated in the third trimester of pregnancy. ' + LEAFLET_EN,
      storage: 'Store below 25°C in a dry place, protected from light.',
    },
    ru: {
      short: 'Противовоспалительное обезболивающее в таблетках.',
      description:
        'Ибупрофен — нестероидный противовоспалительный препарат (НПВП). Показан при головной и зубной боли, менструальной боли, боли в мышцах и суставах, при повышенной температуре.',
      activeIngredients: 'Ибупрофен 400 мг',
      warnings:
        'Не применять без консультации врача при язве желудка и кишечника, нарушениях свёртываемости, болезнях сердца и почек. Противопоказан в третьем триместре беременности. ' + LEAFLET_RU,
    },
  },
  {
    sku: 'ILK-AMO-500', slug: 'amoxicillin-500mg', barcode: '4820000100039',
    name: 'Амоксициллин 500 мг', nameEn: 'Amoxicillin 500 mg', nameRu: 'Амоксициллин 500 мг',
    category: 'joroor-olgoh-em', brand: 'sandoz', manufacturer: 'sandoz-gmbh',
    rx: true, price: 14500, stock: 74, art: 'pill',
    packageSize: '16 капсул', dosageForm: 'Капсул', strength: '500 мг',
    registrationNo: 'ЭМ-2019/0876', expiryMonths: 18, weightGrams: 28,
    soldCount: 138, shelf: 'RX-01', lowStockThreshold: 20,
    mn: {
      short: 'Жороор олгох антибиотик капсул.',
      description:
        'Амоксициллин нь пенициллиний бүлгийн антибиотик бөгөөд бактерийн халдварыг эмчлэхэд эмчийн жороор хэрэглэдэг. Эмчилгээний хугацаа, тун, давтамжийг зөвхөн эмч тогтооно. Вирусын халдвар (ханиад, томуу)-д үйлчлэхгүй.',
      ingredients: 'Амоксициллин тригидрат (амоксициллин 500 мг-тай тэнцэх), магнийн стеарат, желатин капсул.',
      activeIngredients: 'Амоксициллин (amoxicillin) 500 мг',
      dosage:
        'Тунг зөвхөн эмч тогтооно. Эмчийн бичсэн тунг өөрөө нэмэх, багасгах, эмчилгээг хугацаанаас өмнө зогсоох нь бактерийн эсэргүүцэл үүсэх шалтгаан болно.',
      usage: 'Эмчийн зааврын дагуу тогтмол цагийн зайтай, их хэмжээний усаар залгина. Эмчилгээний курсийг бүрэн дуусгана.',
      warnings:
        'Пенициллин, цефалоспорины бүлгийн эмэнд харшилтай хүн хэрэглэхгүй. Бөөрний эмгэг, жирэмсэн, хөхүүл эх, бусад эм хэрэглэж байгаа талаараа эмчид мэдэгдэнэ. Антибиотикийг зөвхөн эмчийн жороор, фармацевтын хяналттайгаар олгоно. ' + LEAFLET_MN,
      sideEffects: 'Дотор муухайрах, суулгах, арьсны тууралт. Амьсгал давчдах, хаван, хүчтэй тууралт үүсвэл шууд эмнэлэгт хандана.',
      storage: '25°C-аас доош, хуурай газар. Хүүхдийн хүрэхээргүй байлгана.',
    },
    en: {
      short: 'Prescription-only antibiotic capsules.',
      description:
        'Amoxicillin is a penicillin-class antibiotic dispensed only on a doctor prescription for bacterial infections. The dose, interval and course length are set exclusively by the prescriber. It has no effect on viral infections such as colds or flu.',
      activeIngredients: 'Amoxicillin 500 mg',
      dosage:
        'Dose is determined by the prescribing doctor only. Changing the dose or stopping the course early contributes to antibiotic resistance.',
      warnings:
        'Not for people allergic to penicillins or cephalosporins. Tell your doctor about kidney disease, pregnancy, breastfeeding and any other medicines. Antibiotics are dispensed only against a valid prescription with pharmacist verification. ' + LEAFLET_EN,
      storage: 'Store below 25°C in a dry place, out of reach of children.',
    },
    ru: {
      short: 'Антибиотик в капсулах, отпускается по рецепту.',
      description:
        'Амоксициллин — антибиотик пенициллинового ряда, отпускается только по рецепту врача при бактериальных инфекциях. Дозу и длительность курса определяет исключительно врач. Не действует на вирусные инфекции.',
      activeIngredients: 'Амоксициллин 500 мг',
      warnings:
        'Не применять при аллергии на пенициллины и цефалоспорины. Сообщите врачу о болезнях почек, беременности, кормлении грудью и других лекарствах. ' + LEAFLET_RU,
    },
  },
  {
    sku: 'ILK-LOR-10', slug: 'loratadine-10mg', barcode: '4820000100046',
    name: 'Лоратадин 10 мг', nameEn: 'Loratadine 10 mg', nameRu: 'Лоратадин 10 мг',
    category: 'harshil', brand: 'krka', manufacturer: 'krka-dd',
    rx: false, price: 6200, stock: 130, art: 'pill',
    packageSize: '10 шахмал', dosageForm: 'Шахмал', strength: '10 мг',
    registrationNo: 'ЭМ-2020/0455', expiryMonths: 24, weightGrams: 20,
    soldCount: 201, shelf: 'A-05',
    mn: {
      short: 'Харшлын эсрэг, нойрмоглуулах нөлөө багатай шахмал.',
      description:
        'Лоратадин нь харшлын эсрэг (антигистамин) эм бөгөөд хамар бөглөрөх, найтаах, нүд, хамар цархирах, арьсны харшлын тууралт зэрэг харшлын шинжийг хөнгөвчлөх заавартай. Хоногт нэг удаа хэрэглэдэг, нойрмоглуулах нөлөө нь бага.',
      ingredients: 'Лоратадин 10 мг, лактоз монохидрат, эрдэнэ шишийн цардуул, магнийн стеарат.',
      activeIngredients: 'Лоратадин (loratadine) 10 мг',
      dosage: 'Насанд хүрэгчид ба 12-оос дээш насны хүүхэд: хоногт 1 удаа 10 мг. Хүүхдийн тунг эмчээс тодруулна.',
      usage: 'Хоолноос үл хамааран, тогтмол нэг цагт усаар залгина.',
      warnings:
        'Элэг, бөөрний эмгэгтэй хүн эмчээс зөвлөгөө авна. Жирэмсэн, хөхүүл эх эмчийн зөвлөгөөгүй хэрэглэхгүй. Харшлын шинж 7 хоногоос удаан үргэлжилбэл эмчид хандана. ' + LEAFLET_MN,
      sideEffects: 'Хааяа толгой өвдөх, ам хатах, нойрмоглох. Хүчтэй хаван, амьсгал давчдвал яаралтай эмнэлэгт хандана.',
      storage: '25°C-аас доош, гэрэл, чийгнээс хамгаалж хадгална.',
    },
    en: {
      short: 'Non-drowsy antihistamine tablet.',
      description:
        'Loratadine is an antihistamine indicated to relieve allergy symptoms such as a blocked or runny nose, sneezing, itchy eyes and allergic skin rash. It is taken once daily and causes little drowsiness.',
      activeIngredients: 'Loratadine 10 mg',
      dosage: 'Adults and children over 12: 10 mg once daily. Ask a pharmacist about paediatric dosing.',
      warnings:
        'Consult a doctor if you have liver or kidney disease. Not for pregnant or breastfeeding women without medical advice. See a doctor if symptoms persist beyond a week. ' + LEAFLET_EN,
      storage: 'Store below 25°C, protected from light and moisture.',
    },
    ru: {
      short: 'Антигистаминные таблетки без выраженной сонливости.',
      description:
        'Лоратадин — антигистаминное средство для облегчения симптомов аллергии: заложенность и течение из носа, чихание, зуд в глазах, аллергическая сыпь. Принимается один раз в сутки.',
      activeIngredients: 'Лоратадин 10 мг',
      warnings:
        'При болезнях печени и почек проконсультируйтесь с врачом. Беременным и кормящим — только по назначению врача. ' + LEAFLET_RU,
    },
  },
  {
    sku: 'ILK-COLD-SYR', slug: 'haniad-syrup-100ml', barcode: '4820000100053',
    name: 'Ханиадны сироп 100 мл', nameEn: 'Cold relief syrup 100 ml', nameRu: 'Сироп от простуды 100 мл',
    category: 'haniad-tomuu', brand: 'monos-pharma', manufacturer: 'monos-group',
    rx: false, price: 12500, discountPrice: 9900, stock: 96, art: 'syrup',
    packageSize: '100 мл', dosageForm: 'Сироп',
    registrationNo: 'ЭМ-2022/0119', expiryMonths: 15, weightGrams: 160,
    featured: true, soldCount: 288, shelf: 'B-03',
    mn: {
      short: 'Ханиалга хөнгөвчлөх, ханиадны шинжид хэрэглэх сироп.',
      description:
        'Ханиалга, хоолой сөрдөх, хамар бөглөрөх зэрэг ханиадны шинжийг хөнгөвчлөх зорилготой сироп. Хэмжих хуруу шилтэй, том, жижиг тунг тусад нь хэмжих боломжтой.',
      ingredients: 'Гуайфенезин, ментол, чихрийн сироп, глицерин, цэвэршүүлсэн ус, натрийн бензоат.',
      activeIngredients: 'Гуайфенезин (guaifenesin), ментол (menthol)',
      dosage:
        'Насанд хүрэгчид: 10 мл, хоногт 3-4 удаа. 6-12 насны хүүхэд: 5 мл, хоногт 3 удаа. 6-аас доош насны хүүхдэд эмчийн зөвлөгөөгүй хэрэглэхгүй.',
      usage: 'Хэрэглэхээсээ өмнө шилийг сайтар сэгсэрч, хамт байгаа хэмжих шилээр тунгаа хэмжинэ.',
      warnings:
        'Сахарын шижин өвчтэй хүн найрлагад чихэр байгааг анхаарна. Ханиалга 7 хоногоос дээш үргэлжилбэл, цустай ханиалга, өндөр халуун дагалдвал эмчид хандана. Бусад ханиадны эмтэй хамт хэрэглэхээсээ өмнө найрлагыг шалгана. ' + LEAFLET_MN,
      sideEffects: 'Дотор муухайрах, толгой эргэх, арьсны тууралт хааяа тохиолдоно.',
      storage: 'Нээхээс өмнө 25°C-аас доош. Нээсний дараа хөргөгчинд, 14 хоногийн дотор хэрэглэнэ.',
    },
    en: {
      short: 'Syrup to ease cough and cold symptoms.',
      description:
        'A syrup intended to ease cough, sore throat and nasal congestion associated with a common cold. Supplied with a measuring cup for adult and child doses.',
      activeIngredients: 'Guaifenesin, menthol',
      dosage:
        'Adults: 10 ml three to four times daily. Children 6-12: 5 ml three times daily. Not for children under 6 without medical advice.',
      warnings:
        'Contains sugar — relevant for people with diabetes. See a doctor if the cough lasts more than a week, or is accompanied by blood or high fever. Check labels before combining with other cold remedies. ' + LEAFLET_EN,
      storage: 'Below 25°C before opening. Refrigerate after opening and use within 14 days.',
    },
    ru: {
      short: 'Сироп для облегчения кашля и симптомов простуды.',
      description:
        'Сироп для облегчения кашля, боли в горле и заложенности носа при простуде. В комплекте мерный стаканчик.',
      activeIngredients: 'Гвайфенезин, ментол',
      warnings:
        'Содержит сахар — учитывайте при диабете. Обратитесь к врачу, если кашель длится более недели. ' + LEAFLET_RU,
    },
  },
  {
    sku: 'ILK-VITC-1000', slug: 'vitamin-c-1000mg', barcode: '4820000100060',
    name: 'Витамин C 1000 мг', nameEn: 'Vitamin C 1000 mg', nameRu: 'Витамин C 1000 мг',
    category: 'darhlaa-demjih', brand: 'solgar', manufacturer: 'solgar-inc',
    rx: false, price: 42000, discountPrice: 35700, stock: 118, art: 'vitamin',
    packageSize: '60 шахмал', dosageForm: 'Шахмал', strength: '1000 мг',
    expiryMonths: 30, weightGrams: 180,
    featured: true, soldCount: 476, shelf: 'V-01',
    mn: {
      short: 'Аскорбины хүчил агуулсан био нэмэлт бүтээгдэхүүн.',
      description:
        'Витамин C (аскорбины хүчил) нь хүний биед шаардлагатай, өөрөө нийлэгжүүлж чаддаггүй витамин юм. Хоолны дэглэмээр хүрэлцээгүй тохиолдолд нэмэлтээр авах зорилготой био нэмэлт бүтээгдэхүүн. Энэ нь эм биш бөгөөд өвчнийг эмчлэх зорилгогүй.',
      ingredients: 'Аскорбины хүчил 1000 мг, микрокристалл целлюлоз, стеарины хүчил, гидроксипропил метилцеллюлоз.',
      activeIngredients: 'Аскорбины хүчил (ascorbic acid) 1000 мг',
      dosage: 'Насанд хүрэгчид: хоногт 1 шахмал. Зөвлөмжид заасан тунгаас хэтрүүлэхгүй.',
      usage: 'Хоолны дараа их хэмжээний усаар залгина.',
      warnings:
        'Бөөрний хайрган өвчтэй, төмрийн хуримтлалын эмгэгтэй хүн эмчээс зөвлөгөө авна. Био нэмэлт бүтээгдэхүүн нь тэнцвэртэй хоолны дэглэмийг орлохгүй. Жирэмсэн, хөхүүл эх эмчээс зөвлөгөө авч хэрэглэнэ.',
      sideEffects: 'Их тунгаар хэрэглэвэл ходоод сөрдөх, суулгах тохиолдол гарна.',
      storage: 'Хуурай, сэрүүн, гэрлээс хамгаалсан газар. Хүүхдийн хүрэхээргүй байлга.',
    },
    en: {
      short: 'Ascorbic acid food supplement.',
      description:
        'Vitamin C (ascorbic acid) is an essential vitamin the body cannot synthesise. This is a food supplement intended to complement the diet when intake is insufficient. It is not a medicine and is not intended to treat disease.',
      activeIngredients: 'Ascorbic acid 1000 mg',
      dosage: 'Adults: one tablet daily. Do not exceed the recommended dose.',
      warnings:
        'People with kidney stones or iron-overload conditions should seek medical advice. A food supplement does not replace a balanced diet. Pregnant and breastfeeding women should consult a doctor. ' + LEAFLET_EN,
      storage: 'Store in a cool, dry place away from light, out of reach of children.',
    },
    ru: {
      short: 'Пищевая добавка с аскорбиновой кислотой.',
      description:
        'Витамин C (аскорбиновая кислота) — незаменимый витамин, который организм не синтезирует. Пищевая добавка для дополнения рациона. Не является лекарством.',
      activeIngredients: 'Аскорбиновая кислота 1000 мг',
      warnings:
        'При камнях в почках и нарушениях обмена железа проконсультируйтесь с врачом. Добавка не заменяет сбалансированное питание. ' + LEAFLET_RU,
    },
  },
  {
    sku: 'ILK-VITD-2000', slug: 'vitamin-d3-2000iu', barcode: '4820000100077',
    name: 'Витамин D3 2000 IU', nameEn: 'Vitamin D3 2000 IU', nameRu: 'Витамин D3 2000 МЕ',
    category: 'vitamin', brand: 'nature-s-bounty', manufacturer: 'solgar-inc',
    rx: false, price: 38000, stock: 142, art: 'vitamin',
    packageSize: '90 капсул', dosageForm: 'Зөөлөн капсул', strength: '2000 IU',
    expiryMonths: 28, weightGrams: 120,
    featured: true, isNew: true, soldCount: 322, shelf: 'V-02',
    mn: {
      short: 'D3 витамин агуулсан зөөлөн капсул.',
      description:
        'Витамин D3 (холекальциферол) нь кальцийн хэвийн шимэгдэлт, ясны эрүүл мэндэд шаардлагатай витамин. Монголын урт хүйтэн өвөл, нарны хүртээмж багатай сараар хоолны дэглэмээр хүрэлцээгүй тохиолдолд нэмэлтээр авах зорилготой био нэмэлт бүтээгдэхүүн.',
      ingredients: 'Холекальциферол (D3) 50 мкг (2000 IU), наранцэцгийн тос, желатин, глицерин.',
      activeIngredients: 'Холекальциферол (cholecalciferol, D3) 2000 IU',
      dosage: 'Насанд хүрэгчид: хоногт 1 капсул. Тунг эмчийн зөвлөгөөгүй хэтрүүлэхгүй.',
      usage: 'Тослог хоолны хамт хэрэглэвэл шимэгдэлт сайжирна.',
      warnings:
        'Цусан дахь кальци өндөр, бөөрний эмгэг, саркоидоз зэрэг тохиолдолд эмчийн хяналтгүй хэрэглэхгүй. D витаминыг хэт их тунгаар удаан хэрэглэх нь хуримтлагдах эрсдэлтэй — тунг эмчээс тодруулна. Хүүхдэд эмчийн зөвлөсөн тунгаар.',
      sideEffects: 'Зөвлөмжийн тунгаар гаж нөлөө бараг тохиолдохгүй. Тун хэтэрвэл дотор муухайрах, ам хатах, бөөлжих.',
      storage: '25°C-аас доош, хуурай, гэрлээс хамгаалсан газар.',
    },
    en: {
      short: 'Vitamin D3 softgel capsules.',
      description:
        'Vitamin D3 (cholecalciferol) is needed for normal calcium absorption and bone health. A food supplement for months when dietary intake and sun exposure are low — relevant through the long Mongolian winter.',
      activeIngredients: 'Cholecalciferol (D3) 2000 IU',
      dosage: 'Adults: one capsule daily. Do not exceed without medical advice.',
      warnings:
        'Not to be used without medical supervision in hypercalcaemia, kidney disease or sarcoidosis. Prolonged high-dose vitamin D accumulates — confirm the dose with a doctor. Paediatric use only at a doctor-advised dose. ' + LEAFLET_EN,
      storage: 'Store below 25°C in a dry place away from light.',
    },
    ru: {
      short: 'Витамин D3 в мягких капсулах.',
      description:
        'Витамин D3 (холекальциферол) необходим для нормального усвоения кальция и здоровья костей. Пищевая добавка для периодов недостатка солнца и поступления с пищей.',
      activeIngredients: 'Холекальциферол (D3) 2000 МЕ',
      warnings:
        'Не применять без контроля врача при повышенном кальции, болезнях почек, саркоидозе. Длительный приём высоких доз приводит к накоплению. ' + LEAFLET_RU,
    },
  },
  {
    sku: 'ILK-OMRON-M3', slug: 'omron-m3-comfort', barcode: '4820000100084',
    name: 'Omron M3 Comfort даралт хэмжигч', nameEn: 'Omron M3 Comfort blood pressure monitor', nameRu: 'Тонометр Omron M3 Comfort',
    category: 'daralt-hemjigch', brand: 'omron', manufacturer: 'omron-healthcare',
    rx: false, price: 285000, discountPrice: 249000, stock: 22, art: 'device',
    packageSize: '1 хэрэгсэл', dosageForm: 'Автомат хэрэгсэл',
    expiryMonths: 60, weightGrams: 460,
    featured: true, soldCount: 64, shelf: 'D-01', lowStockThreshold: 5,
    mn: {
      short: 'Гарын дээд талд хэмжих автомат цусны даралт хэмжигч.',
      description:
        'Omron M3 Comfort нь гэрийн нөхцөлд цусны даралт, судасны лугшилтыг хэмжих автомат хэрэгсэл. Intelli Wrap ханцуй нь гарны эргэн тойронд тэгш даралт үүсгэдэг тул ханцуйны байрлалаас үүдэх хэмжилтийн зөрүү багасдаг. 60 хэмжилтийн санах ой, зүрхний хэм алдалтын дүрс тэмдэг, хэт хөдөлгөөний сануулга бүхий.',
      ingredients: 'Хэрэгсэл, Intelli Wrap ханцуй (22-42 см), 4 x AA батарей, хадгалах гэр, хэрэглэх заавар.',
      activeIngredients: '—',
      dosage:
        'Хэмжилтийг өдөрт тогтмол цагт, 5 минут амарсны дараа, суугаа байрлалд гүйцэтгэнэ. Хэмжилтийн тайлбарыг эмч, фармацевтаас авна.',
      usage:
        'Ханцуйг далны доод хэсгээс 2-3 см дээгүүр, зүрхний түвшинд байрлуулна. Хэмжилтийн үед хөдөлж, ярихгүй. Гарсан тоо нь өөрөө онош биш — эмчийн үнэлгээ шаардлагатай.',
      warnings:
        'Хэрэгслийн үзүүлэлт нь эмчийн үзлэг, оношийг орлохгүй. Өндөр эсвэл хэт бага даралт байнга гарвал эмчид хандана. Зүрхний хэм алдалт, судасны эмгэгтэй хүн эмчийн зөвлөгөөний дагуу хэрэглэнэ.',
      sideEffects: 'Ханцуй хэт чанга үед гарт таг мэдрэгдэх, ойр давтан хэмжвэл гар хөхрөх тохиолдол гарна.',
      storage: 'Хуурай, тоос, чийггүй газар. Урт хугацаанд хэрэглэхгүй бол батарейг гаргана.',
    },
    en: {
      short: 'Automatic upper-arm blood pressure monitor.',
      description:
        'The Omron M3 Comfort measures blood pressure and pulse at home. The Intelli Wrap cuff applies even pressure around the arm, reducing variation caused by cuff position. Includes 60-reading memory, an irregular heartbeat indicator and a movement alert.',
      activeIngredients: '—',
      dosage:
        'Measure at the same time each day, seated, after five minutes of rest. Have a doctor or pharmacist interpret the readings.',
      warnings:
        'Readings do not replace a medical examination or diagnosis. Consult a doctor if values are persistently high or low. People with arrhythmia or vascular disease should use it as advised by their doctor. ' + LEAFLET_EN,
      storage: 'Keep dry and dust-free. Remove batteries during long periods of non-use.',
    },
    ru: {
      short: 'Автоматический тонометр на плечо.',
      description:
        'Omron M3 Comfort измеряет артериальное давление и пульс в домашних условиях. Манжета Intelli Wrap обеспечивает равномерное давление, снижая влияние положения манжеты. Память на 60 измерений, индикатор аритмии.',
      activeIngredients: '—',
      warnings:
        'Показания прибора не заменяют осмотр и диагноз врача. При стойко высоких или низких значениях обратитесь к врачу. ' + LEAFLET_RU,
    },
  },
  {
    sku: 'ILK-THERM-FT', slug: 'beurer-ft-09-thermometer', barcode: '4820000100091',
    name: 'Beurer FT 09 термометр', nameEn: 'Beurer FT 09 thermometer', nameRu: 'Термометр Beurer FT 09',
    category: 'termometr', brand: 'beurer', manufacturer: 'beurer-gmbh',
    rx: false, price: 18500, stock: 58, art: 'thermometer',
    packageSize: '1 хэрэгсэл', dosageForm: 'Дижитал термометр',
    expiryMonths: 60, weightGrams: 45,
    soldCount: 152, shelf: 'D-04',
    mn: {
      short: 'Мөнгөн ус агуулаагүй дижитал термометр.',
      description:
        'Гэрийн нөхцөлд биеийн температурыг хэмжих дижитал термометр. Хэмжилт дуусахад дуут сигнал гарна, сүүлийн хэмжилтийг санах ойд хадгална. Мөнгөн ус агуулаагүй, хүүхэд, насанд хүрэгчид хэрэглэхэд тохиромжтой. Ус үл нэвтрэх бүтэц.',
      ingredients: 'Термометр, батарей (LR41), хадгалах гэр, хэрэглэх заавар.',
      activeIngredients: '—',
      dosage: 'Хэмжилтийн байрлал (суга, ам, шулуун гэдэс) тус бүрийн хэвийн хязгаар өөр байдгийг анхаарна.',
      usage:
        'Хэмжихээсээ өмнө үзүүрийг спиртээр арчина. Дуут сигнал гарах хүртэл хөдөлгөөнгүй барина. Хэрэглэсний дараа цэвэрлэж, гэрт хийж хадгална.',
      warnings:
        'Хэмжилтийн үзүүлэлт нь оношийг орлохгүй. Нярай, бага насны хүүхдэд өндөр халуун гарвал, эсвэл халуун хоёр хоногоос дээш үргэлжилбэл эмчид хандана.',
      sideEffects: '—',
      storage: 'Хуурай, сэрүүн газар. Хүүхдийн хүрэхээргүй байлга (жижиг батарей залгих эрсдэлтэй).',
    },
    en: {
      short: 'Mercury-free digital thermometer.',
      description:
        'A digital thermometer for measuring body temperature at home. Beeps when the reading is complete and stores the last measurement. Mercury-free, suitable for children and adults, water-resistant housing.',
      activeIngredients: '—',
      dosage: 'Normal ranges differ by measurement site (axillary, oral, rectal) — note this when comparing readings.',
      warnings:
        'A reading does not replace a diagnosis. Contact a doctor for high fever in infants and small children, or if fever lasts more than two days. ' + LEAFLET_EN,
      storage: 'Keep in a cool dry place, out of reach of children (small battery is a swallowing hazard).',
    },
    ru: {
      short: 'Цифровой термометр без ртути.',
      description:
        'Цифровой термометр для измерения температуры тела дома. Звуковой сигнал по окончании измерения, память последнего результата. Без ртути, водостойкий корпус.',
      activeIngredients: '—',
      warnings:
        'Показание не заменяет диагноз. При высокой температуре у младенцев или лихорадке дольше двух дней обратитесь к врачу. ' + LEAFLET_RU,
    },
  },
]
