import type { SeedProduct } from './seed-products-a'

const L_MN = 'Хэрэглэхээсээ өмнө зааврыг уншиж, эмч, фармацевтаас зөвлөгөө аваарай.'
const L_EN = 'Read the leaflet before use and consult a doctor or pharmacist.'
const L_RU = 'Перед применением прочитайте инструкцию и обратитесь к врачу или фармацевту.'

export const PRODUCTS_B: SeedProduct[] = [
  {
    sku: 'ILK-OMEP-20', slug: 'omeprazole-20mg', barcode: '4820000100107',
    name: 'Омепразол 20 мг', nameEn: 'Omeprazole 20 mg', nameRu: 'Омепразол 20 мг',
    category: 'hool-bolovsruulah', brand: 'krka', manufacturer: 'krka-dd',
    rx: true, price: 16800, stock: 68, art: 'pill',
    packageSize: '28 капсул', dosageForm: 'Гэдсэнд шимэгддэг капсул', strength: '20 мг',
    registrationNo: 'ЭМ-2020/0512', expiryMonths: 20, weightGrams: 32,
    soldCount: 96, shelf: 'RX-02', lowStockThreshold: 15,
    mn: {
      short: 'Ходоодны хүчил бууруулах, жороор олгох капсул.',
      description:
        'Омепразол нь протон насосны хориглогч (PPI) бүлгийн эм бөгөөд ходоодны хүчил үүсэлтийг бууруулна. Ходоод, дэлүүн гэдэсний шархлаа, рефлюкс өвчний эмчилгээнд эмчийн жороор хэрэглэнэ. Эмчилгээний хугацааг эмч тогтооно.',
      ingredients: 'Омепразол 20 мг, маннитол, гипромеллоз, метакрилын хүчлийн копольмер, титан диоксид.',
      activeIngredients: 'Омепразол (omeprazole) 20 мг',
      dosage: 'Тунг эмч тогтооно. Ерөнхийдөө хоногт 1 удаа, өглөө хоолны 30 минутын өмнө.',
      usage: 'Капсулыг бүтнээр залгина — зажлах, нухах, хагалахгүй. Гэдсэнд шимэгдэх бүрхүүлийг эвдэх нь үйлчлэлийг буруутгана.',
      warnings:
        'Урт хугацаанд хэрэглэвэл B12 витамин, магни, кальцийн шимэгдэлт багасах эрсдэлтэй тул эмчийн хяналт шаардлагатай. Ходоодны хорт хавдрын шинжийг нуух эрсдэлтэй — тайлбаргүй турах, залгихад бэрхшээлтэй, цустай бөөлжис үүсвэл яаралтай эмчид хандана. Жирэмсэн, хөхүүл эх эмчид мэдэгдэнэ. ' + L_MN,
      sideEffects: 'Толгой өвдөх, суулгах, гэдэс дүүрэх, дотор муухайрах.',
      storage: '25°C-аас доош, эх савлагаанд, чийгнээс хамгаалж хадгална.',
    },
    en: {
      short: 'Prescription acid-reducing capsules.',
      description:
        'Omeprazole is a proton pump inhibitor (PPI) that reduces gastric acid production. Prescribed for gastric and duodenal ulcers and reflux disease. The treatment length is set by the doctor.',
      activeIngredients: 'Omeprazole 20 mg',
      dosage: 'Dose is set by the prescriber; typically once daily, 30 minutes before breakfast.',
      warnings:
        'Long-term use may reduce absorption of vitamin B12, magnesium and calcium and needs medical supervision. It can mask symptoms of gastric cancer — seek urgent care for unexplained weight loss, difficulty swallowing or vomiting blood. ' + L_EN,
      storage: 'Store below 25°C in the original packaging, protected from moisture.',
    },
    ru: {
      short: 'Капсулы, снижающие кислотность; по рецепту.',
      description:
        'Омепразол — ингибитор протонного насоса, снижающий выработку желудочной кислоты. Назначается при язве желудка и двенадцатиперстной кишки, рефлюксной болезни.',
      activeIngredients: 'Омепразол 20 мг',
      warnings:
        'Длительный приём требует контроля врача. Может маскировать симптомы рака желудка — при похудении без причины, трудностях глотания, кровавой рвоте срочно к врачу. ' + L_RU,
    },
  },
  {
    sku: 'ILK-SMECT', slug: 'smecta-powder', barcode: '4820000100114',
    name: 'Диосмектит нунтаг', nameEn: 'Diosmectite powder', nameRu: 'Диосмектит порошок',
    category: 'hool-bolovsruulah', brand: 'asian-pharma', manufacturer: 'asian-pharma-llc',
    rx: false, price: 9800, stock: 154, art: 'syrup',
    packageSize: '10 x 3 г нунтаг', dosageForm: 'Ууна нунтаг',
    registrationNo: 'ЭМ-2021/0288', expiryMonths: 24, weightGrams: 45,
    soldCount: 233, shelf: 'B-06',
    mn: {
      short: 'Суулгалтын үед хэрэглэх ууна нунтаг.',
      description:
        'Диосмектит нь гэдэсний хананд хамгаалах үе үүсгэдэг байгалийн шаварлаг бодис. Цочмог болон архаг суулгалт, гэдэсний бархиралт, дүүрэлтийн үед хэрэглэх заавартай. Шимэгддэггүй тул системийн үйлчлэл багатай.',
      ingredients: 'Диосмектит 3 г, глюкоз монохидрат, ванилийн үнэр, натрийн сахаринат.',
      activeIngredients: 'Диосмектит (diosmectite) 3 г',
      dosage:
        'Насанд хүрэгчид: хоногт 3 удаа 1 нунтаг. Хүүхдэд наснаас хамаарч 1-2 нунтаг — фармацевтаас тодруулна.',
      usage: 'Нунтгийг 50 мл усанд сайтар хутгаж уусгана. Бусад эмнээс 1.5-2 цагийн зайтай хэрэглэнэ (шимэгдэлтэд нөлөөлнө).',
      warnings:
        'Суулгалтын үед шингэн, электролит нөхөх нь эмчилгээний гол хэсэг — нөхөн сэргээх шингэн (ORS) хамт хэрэглэхийг зөвлөнө. Хүүхэд, өндөр настанд суулгалт 2 хоногоос дээш үргэлжилбэл, өндөр халуун, цустай бааж дагалдвал яаралтай эмчид хандана. ' + L_MN,
      sideEffects: 'Хааяа өтгөн хатах, гэдэс дүүрэх.',
      storage: 'Хуурай, 25°C-аас доош газар хадгална.',
    },
    en: {
      short: 'Oral powder for diarrhoea.',
      description:
        'Diosmectite is a natural clay-based agent that forms a protective layer on the intestinal wall. Indicated for acute and chronic diarrhoea, bloating and abdominal discomfort. It is not absorbed, so systemic effects are minimal.',
      activeIngredients: 'Diosmectite 3 g',
      dosage: 'Adults: one sachet three times daily. Children: 1-2 sachets by age — ask a pharmacist.',
      warnings:
        'Fluid and electrolyte replacement is the core of diarrhoea management — oral rehydration salts are recommended alongside. Seek urgent care for diarrhoea lasting over two days in children or older adults, or with high fever or blood in the stool. ' + L_EN,
      storage: 'Store in a dry place below 25°C.',
    },
    ru: {
      short: 'Порошок для приёма внутрь при диарее.',
      description:
        'Диосмектит — природное глинистое средство, образующее защитный слой на стенке кишечника. Показан при острой и хронической диарее, вздутии.',
      activeIngredients: 'Диосмектит 3 г',
      warnings:
        'Восполнение жидкости и электролитов — основа лечения диареи. При диарее более двух суток, высокой температуре или крови в стуле срочно к врачу. ' + L_RU,
    },
  },
  {
    sku: 'ILK-CETI-10', slug: 'cetirizine-10mg', barcode: '4820000100121',
    name: 'Цетиризин 10 мг', nameEn: 'Cetirizine 10 mg', nameRu: 'Цетиризин 10 мг',
    category: 'harshil', brand: 'sandoz', manufacturer: 'sandoz-gmbh',
    rx: false, price: 5800, discountPrice: 4900, stock: 176, art: 'pill',
    packageSize: '10 шахмал', dosageForm: 'Бүрсэн шахмал', strength: '10 мг',
    registrationNo: 'ЭМ-2020/0467', expiryMonths: 23, weightGrams: 18,
    soldCount: 264, shelf: 'A-06',
    mn: {
      short: 'Харшлын эсрэг шахмал, хоногт нэг удаа.',
      description:
        'Цетиризин нь антигистамин эм бөгөөд ойр орчны харшил (тоос, хөгц, тэжээвэр амьтны хөс), харшлын хамрын үрэвсэл, чонын хөрвөс зэрэгт хэрэглэх заавартай. Хоногт нэг удаа хэрэглэнэ.',
      ingredients: 'Цетиризин дихидрохлорид 10 мг, лактоз, эрдэнэ шишийн цардуул, магнийн стеарат, гипромеллоз.',
      activeIngredients: 'Цетиризин (cetirizine) 10 мг',
      dosage: 'Насанд хүрэгчид ба 12-оос дээш хүүхэд: хоногт 1 удаа 10 мг, аль болох орой. 6-12 нас: эмчээс тодруулна.',
      usage: 'Усаар бүтнээр залгина. Хоолноос үл хамаарна.',
      warnings:
        'Нойрмоглуулах нөлөө үзүүлж болзошгүй — автомашин барих, машин механизм ажиллуулахдаа сэрэмжтэй. Архитай хамт хэрэглэхгүй. Бөөрний эмгэгтэй хүн тунг эмчээс тодруулна. Жирэмсэн, хөхүүл эх эмчийн зөвлөгөөгүй хэрэглэхгүй. ' + L_MN,
      sideEffects: 'Нойрмоглох, ам хатах, толгой өвдөх, ядрах.',
      storage: '25°C-аас доош, гэрэл, чийгнээс хамгаална.',
    },
    en: {
      short: 'Once-daily antihistamine tablet.',
      description:
        'Cetirizine is an antihistamine indicated for environmental allergies (dust, mould, pet dander), allergic rhinitis and urticaria. Taken once daily.',
      activeIngredients: 'Cetirizine 10 mg',
      dosage: 'Adults and children over 12: 10 mg once daily, preferably in the evening. Ages 6-12: ask a doctor.',
      warnings:
        'May cause drowsiness — take care when driving or operating machinery. Do not combine with alcohol. Dose adjustment is needed in kidney disease. ' + L_EN,
      storage: 'Store below 25°C, protected from light and moisture.',
    },
    ru: {
      short: 'Антигистаминные таблетки один раз в сутки.',
      description:
        'Цетиризин — антигистаминное средство при бытовой аллергии (пыль, плесень, шерсть животных), аллергическом рините и крапивнице.',
      activeIngredients: 'Цетиризин 10 мг',
      warnings:
        'Может вызывать сонливость — осторожно при вождении. Не сочетать с алкоголем. При болезнях почек нужна коррекция дозы. ' + L_RU,
    },
  },
  {
    sku: 'ILK-ASP-100', slug: 'aspirin-cardio-100mg', barcode: '4820000100138',
    name: 'Аспирин Кардио 100 мг', nameEn: 'Aspirin Cardio 100 mg', nameRu: 'Аспирин Кардио 100 мг',
    category: 'joroor-olgoh-em', brand: 'bayer', manufacturer: 'bayer-ag',
    rx: true, price: 19500, stock: 52, art: 'pill',
    packageSize: '28 шахмал', dosageForm: 'Гэдсэнд шимэгддэг шахмал', strength: '100 мг',
    registrationNo: 'ЭМ-2018/0655', expiryMonths: 21, weightGrams: 26,
    soldCount: 88, shelf: 'RX-03', lowStockThreshold: 12,
    mn: {
      short: 'Зүрх судасны урьдчилан сэргийлэлтэд эмчийн жороор.',
      description:
        'Ацетилсалицилын хүчлийн бага тунгаар зүрх судасны эмгэгийн урьдчилан сэргийлэлтэд эмчийн зааврын дагуу хэрэглэдэг. Хэн хэрэглэх, хэдий хугацаанд хэрэглэхийг зөвхөн эмч тогтоох ёстой — өөрөө шийдэж хэрэглэх нь цус гоожих эрсдэлтэй.',
      ingredients: 'Ацетилсалицилын хүчил 100 мг, эрдэнэ шишийн цардуул, целлюлоз, метакрилын хүчлийн копольмер.',
      activeIngredients: 'Ацетилсалицилын хүчил (acetylsalicylic acid) 100 мг',
      dosage: 'Тунг зөвхөн эмч тогтооно. Ерөнхийдөө хоногт 1 удаа 100 мг.',
      usage: 'Шахмалыг бүтнээр, хоолны өмнө их хэмжээний усаар залгина. Хагалж, зажлахгүй.',
      warnings:
        'Ходоод, гэдэсний шархлаа, цус гоожих эмгэг, хүнд элэг, бөөрний дутагдалтай хүн хэрэглэхгүй. 16-аас доош насны хүүхдэд вирусын халдварын үед хэрэглэхийг хориглоно (Рейн синдром). Хагалгаа, шүдний эмчилгээний өмнө эмчид мэдэгдэнэ. Бусад цус шингэлэх эмтэй хамт эмчийн хяналтгүй хэрэглэхгүй. ' + L_MN,
      sideEffects: 'Ходоод сөрдөх, цус гоожих хугацаа удаашрах, хааяа харшлын шинж.',
      storage: '25°C-аас доош, эх савлагаанд хадгална.',
    },
    en: {
      short: 'Low-dose cardiovascular prophylaxis, prescription only.',
      description:
        'Low-dose acetylsalicylic acid used for cardiovascular prophylaxis strictly as directed by a doctor. Who should take it, and for how long, is a decision for the prescriber — self-initiated use carries a bleeding risk.',
      activeIngredients: 'Acetylsalicylic acid 100 mg',
      dosage: 'Dose is set by the prescriber; typically 100 mg once daily.',
      warnings:
        'Not for people with peptic ulcers, bleeding disorders, or severe liver or kidney failure. Contraindicated in children under 16 during viral infection (Reye syndrome). Tell your doctor or dentist before any procedure. Do not combine with other blood thinners without supervision. ' + L_EN,
      storage: 'Store below 25°C in the original packaging.',
    },
    ru: {
      short: 'Низкодозированная профилактика ССЗ, по рецепту.',
      description:
        'Ацетилсалициловая кислота в низкой дозе для профилактики сердечно-сосудистых заболеваний строго по назначению врача.',
      activeIngredients: 'Ацетилсалициловая кислота 100 мг',
      warnings:
        'Не применять при язве, нарушениях свёртываемости, тяжёлой печёночной и почечной недостаточности. Противопоказан детям до 16 лет при вирусной инфекции. ' + L_RU,
    },
  },
  {
    sku: 'ILK-METF-850', slug: 'metformin-850mg', barcode: '4820000100145',
    name: 'Метформин 850 мг', nameEn: 'Metformin 850 mg', nameRu: 'Метформин 850 мг',
    category: 'joroor-olgoh-em', brand: 'krka', manufacturer: 'krka-dd',
    rx: true, price: 13200, stock: 61, art: 'pill',
    packageSize: '30 шахмал', dosageForm: 'Бүрсэн шахмал', strength: '850 мг',
    registrationNo: 'ЭМ-2019/0721', expiryMonths: 19, weightGrams: 40,
    soldCount: 74, shelf: 'RX-04', lowStockThreshold: 15,
    mn: {
      short: 'Сахарын шижингийн эмчилгээнд эмчийн жороор.',
      description:
        '2-р хэлбэрийн сахарын шижин өвчний эмчилгээнд эмчийн жороор хэрэглэдэг эм. Тун, хэрэглэх давтамж, хяналтын шинжилгээг эмч тогтооно. Хоолны дэглэм, хөдөлгөөний зөвлөмжтэй хамт хэрэглэдэг.',
      ingredients: 'Метформин гидрохлорид 850 мг, повидон, магнийн стеарат, гипромеллоз, макрогол.',
      activeIngredients: 'Метформин (metformin) 850 мг',
      dosage: 'Тунг зөвхөн эмч тогтооно. Хоолны дундуур эсвэл дараа хэрэглэдэг.',
      usage: 'Шахмалыг бүтнээр, хоолны хамт залгина. Ходоодны гаж нөлөө багасахын тулд тунг эмч аажим нэмдэг.',
      warnings:
        'Бөөрний хүнд дутагдал, элэгний эмгэг, хүчил-суурийн тэнцвэрийн эмгэгтэй хүн хэрэглэхгүй. Мэс засал, тодосгогч бодис хэрэглэсэн шинжилгээний өмнө эмчид мэдэгдэж, эмийг түр зогсоох шаардлагатай. Архи хэрэглэх нь лактат ацидозын эрсдэл нэмнэ. Тайлбаргүй ядрах, булчин өвдөх, амьсгал давчдвал яаралтай эмнэлэгт хандана. ' + L_MN,
      sideEffects: 'Дотор муухайрах, суулгах, амны металл өнгө, ходоод дүүрэх. Ихэвчлэн эмчилгээний эхэнд.',
      storage: '30°C-аас доош, эх савлагаанд хадгална.',
    },
    en: {
      short: 'Type 2 diabetes therapy, prescription only.',
      description:
        'Prescribed for type 2 diabetes. The dose, schedule and monitoring tests are set by the doctor and used alongside diet and activity advice.',
      activeIngredients: 'Metformin 850 mg',
      dosage: 'Dose is set by the prescriber. Taken with or after food.',
      warnings:
        'Not for people with severe kidney failure, liver disease or acid-base disorders. Tell your doctor before surgery or contrast imaging — the medicine may need to be paused. Alcohol increases lactic acidosis risk. Seek urgent care for unexplained fatigue, muscle pain or breathlessness. ' + L_EN,
      storage: 'Store below 30°C in the original packaging.',
    },
    ru: {
      short: 'Терапия диабета 2 типа, по рецепту.',
      description:
        'Назначается при диабете 2 типа. Дозу, схему и контрольные анализы определяет врач, вместе с рекомендациями по питанию и активности.',
      activeIngredients: 'Метформин 850 мг',
      warnings:
        'Не применять при тяжёлой почечной недостаточности, болезнях печени. Сообщите врачу перед операцией или КТ с контрастом. Алкоголь повышает риск лактоацидоза. + ' + L_RU,
    },
  },
  {
    sku: 'ILK-SALB-INH', slug: 'salbutamol-inhaler', barcode: '4820000100152',
    name: 'Салбутамол аэрозоль', nameEn: 'Salbutamol inhaler', nameRu: 'Салбутамол аэрозоль',
    category: 'joroor-olgoh-em', brand: 'gsk', manufacturer: 'gsk-plc',
    rx: true, price: 24500, stock: 43, art: 'device',
    packageSize: '200 тун', dosageForm: 'Амьсгалын аэрозоль', strength: '100 мкг/тун',
    registrationNo: 'ЭМ-2019/0433', expiryMonths: 17, weightGrams: 62,
    soldCount: 59, shelf: 'RX-05', lowStockThreshold: 10,
    mn: {
      short: 'Амьсгалын замын аэрозоль, эмчийн жороор.',
      description:
        'Салбутамол нь гуурсан хоолойн гөлгөр булчинг сулруулах үйлчлэлтэй, багтраа болон амьсгал давчдах шинжийн үед эмчийн зааврын дагуу хэрэглэдэг амьсгалын аэрозоль. Хэрэглэх аргыг эмч, фармацевт биечлэн зааж өгөх шаардлагатай.',
      ingredients: 'Салбутамол сульфат (салбутамол 100 мкг-тай тэнцэх), норфлуран (HFA-134a).',
      activeIngredients: 'Салбутамол (salbutamol) 100 мкг/тун',
      dosage:
        'Тунг эмч тогтооно. Шинж тэмдгийн үед хэрэглэх давтамж, өдөрт хэрэглэх дээд хязгаарыг эмчээс тодруулна.',
      usage:
        'Хэрэглэхээсээ өмнө сэгсэрнэ. Гүн амьсгал гаргаад, хошуувчийг амандаа хийж, дарахтай зэрэг гүн амьсгаа авч 10 секунд барина. Хэрэглэсний дараа амаа зайлна.',
      warnings:
        'Аэрозолийг хэрэглэх шаардлага өссөн, шөнө сэрэх, өмнөх тунгаар хөнгөрөхгүй болсон бол эмчид нэн даруй хандана — өвчний хяналт хангалтгүй байгаагийн шинж. Зүрхний эмгэг, бамбайн хэт үйл ажиллагаа, хэм алдалттай хүн эмчид мэдэгдэнэ. Амьсгал хүчтэй давчдаж, аэрозоль тус болохгүй бол 103 дугаарт холбогдоно. ' + L_MN,
      sideEffects: 'Гар чичрэх, зүрх дэлсэх, толгой өвдөх, булчин базлах.',
      storage: '30°C-аас доош. Хөлдөөхгүй, шууд наранд, галд тавихгүй. Савыг цоолж, шатаахгүй.',
    },
    en: {
      short: 'Reliever inhaler, prescription only.',
      description:
        'Salbutamol relaxes the smooth muscle of the airways and is used as directed by a doctor for asthma and breathlessness. Inhaler technique must be demonstrated in person by a doctor or pharmacist.',
      activeIngredients: 'Salbutamol 100 mcg per dose',
      dosage: 'Dose is set by the prescriber. Confirm the maximum number of daily doses with your doctor.',
      warnings:
        'If you need the inhaler more often, wake at night, or it no longer relieves symptoms, contact your doctor promptly — this signals poor disease control. Tell your doctor about heart disease, arrhythmia or overactive thyroid. If breathing is severely impaired and the inhaler does not help, call 103. ' + L_EN,
      storage: 'Below 30°C. Do not freeze, expose to direct sun or fire. Do not pierce or burn the canister.',
    },
    ru: {
      short: 'Ингалятор для облегчения дыхания, по рецепту.',
      description:
        'Салбутамол расслабляет гладкие мышцы дыхательных путей, применяется по назначению врача при астме и одышке. Технику ингаляции должен показать врач или фармацевт.',
      activeIngredients: 'Салбутамол 100 мкг/дозу',
      warnings:
        'Если потребность в ингаляторе растёт или он перестал помогать — срочно к врачу. При тяжёлой одышке звоните 103. ' + L_RU,
    },
  },
  {
    sku: 'ILK-BIODER-H2O', slug: 'bioderma-sensibio-h2o-500ml', barcode: '4820000100169',
    name: 'Bioderma Sensibio H2O 500 мл', nameEn: 'Bioderma Sensibio H2O 500 ml', nameRu: 'Bioderma Sensibio H2O 500 мл',
    category: 'aris-archilgaa', brand: 'bioderma', manufacturer: 'naos-bioderma',
    rx: false, price: 68000, discountPrice: 58000, stock: 87, art: 'cream',
    packageSize: '500 мл', dosageForm: 'Мицелляр шингэн',
    expiryMonths: 34, weightGrams: 540,
    featured: true, soldCount: 341, shelf: 'C-01',
    mn: {
      short: 'Мэдрэмтгий арьсанд зориулсан мицелляр цэвэрлэгч шингэн.',
      description:
        'Мэдрэмтгий арьсны өдөр тутмын цэвэрлэгээнд зориулсан мицелляр шингэн. Нүүрний будаг, тос, тоосыг зайлуулж, зайлах шаардлагагүй. Үнэргүй, спиртгүй, нүдний эмзэг хэсэгт тохиромжтой.',
      ingredients: 'Ус, PEG-6 каприл/капрын глицерид, cucumis sativus хийц, манnitol, xylitol, rhamnose, fructooligosaccharides.',
      activeIngredients: 'Мицелляр цэвэрлэх систем (спиртгүй, үнэргүй)',
      dosage: '—',
      usage:
        'Хөвөнг шингээж, нүүр, нүдний хэсгийг зөөлөн арчина. Зайлах шаардлагагүй. Өдөрт 2 удаа (өглөө, орой) хэрэглэнэ.',
      warnings:
        'Зөвхөн гадуур хэрэглэнэ. Нүдэнд орвол ихээхэн усаар зайлна. Арьс улайх, цархирах, хаван үүсвэл хэрэглэхээ зогсоож, эмчид хандана. Шархалсан, нээлттэй шарханд хэрэглэхгүй.',
      sideEffects: 'Хааяа арьсны мэдрэмтгий шинж, улайлт.',
      storage: 'Хэвийн температурт, шууд нарнаас хамгаалж хадгална.',
    },
    en: {
      short: 'Micellar cleansing water for sensitive skin.',
      description:
        'A micellar water for the daily cleansing of sensitive skin. Removes make-up, oil and dust without rinsing. Fragrance-free and alcohol-free, suitable for the delicate eye area.',
      activeIngredients: 'Micellar cleansing system (alcohol-free, fragrance-free)',
      dosage: '—',
      warnings:
        'For external use only. Rinse thoroughly with water if it gets in the eyes. Stop use and see a doctor if redness, itching or swelling occurs. Do not apply to broken skin. ' + L_EN,
      storage: 'Store at room temperature away from direct sunlight.',
    },
    ru: {
      short: 'Мицеллярная вода для чувствительной кожи.',
      description:
        'Мицеллярная вода для ежедневного очищения чувствительной кожи. Удаляет макияж, жир и пыль без смывания. Без спирта и ароматизаторов.',
      activeIngredients: 'Мицеллярная очищающая система (без спирта и ароматизаторов)',
      warnings:
        'Только для наружного применения. При попадании в глаза промойте водой. При покраснении или зуде прекратите использование. ' + L_RU,
    },
  },
  {
    sku: 'ILK-CERAVE-MB', slug: 'cerave-moisturising-cream-340g', barcode: '4820000100176',
    name: 'CeraVe чийгшүүлэх тос 340 г', nameEn: 'CeraVe Moisturising Cream 340 g', nameRu: 'CeraVe увлажняющий крем 340 г',
    category: 'aris-archilgaa', brand: 'cerave', manufacturer: 'loreal-cerave',
    rx: false, price: 79000, stock: 64, art: 'cream',
    packageSize: '340 г', dosageForm: 'Тос',
    expiryMonths: 32, weightGrams: 380,
    featured: true, isNew: true, soldCount: 187, shelf: 'C-02',
    mn: {
      short: 'Керамид агуулсан, хуурай арьсанд зориулсан чийгшүүлэх тос.',
      description:
        'Хуурай, маш хуурай арьсанд зориулсан чийгшүүлэх тос. Гурван төрлийн керамид, гиалуроны хүчил агуулна. Үнэргүй, комедон үүсгэхгүй. Монголын хуурай, хүйтэн уур амьсгалд арьсны чийгийн хамгаалалтыг дэмжих зорилготой.',
      ingredients: 'Ус, глицерин, керамид NP/AP/EOP, гиалуроны хүчил, цетеарил спирт, петролатум, фитосфингозин.',
      activeIngredients: 'Керамид NP, AP, EOP; гиалуроны хүчил; глицерин',
      dosage: '—',
      usage:
        'Өдөрт 1-2 удаа, шүршүүрийн дараа арьс чийгтэй байхад цэвэр арьсанд зөөлөн тавьж түрхнэ. Нүүр, бие хоёуланд хэрэглэж болно.',
      warnings:
        'Зөвхөн гадуур хэрэглэнэ. Нүдэнд орохоос сэрэмжлэнэ. Арьсны хүчтэй улайлт, цархиралт үүсвэл хэрэглэхээ зогсооно. Хүнд арьсны эмгэг (атопик дермантит, псориаз) байгаа бол эмчийн зөвлөгөөний дагуу хэрэглэнэ.',
      sideEffects: 'Хааяа хэрэглэсэн хэсэгт цархиралт, улайлт.',
      storage: 'Хэвийн температурт, нарны шууд тусгалаас хамгаална.',
    },
    en: {
      short: 'Ceramide moisturiser for dry skin.',
      description:
        'A moisturising cream for dry and very dry skin, with three essential ceramides and hyaluronic acid. Fragrance-free and non-comedogenic — intended to support the skin barrier in the dry, cold Mongolian climate.',
      activeIngredients: 'Ceramides NP, AP, EOP; hyaluronic acid; glycerin',
      dosage: '—',
      warnings:
        'For external use only. Avoid contact with the eyes. Stop use if marked redness or itching occurs. With a diagnosed skin condition, use as advised by a doctor. ' + L_EN,
      storage: 'Store at room temperature away from direct sunlight.',
    },
    ru: {
      short: 'Увлажняющий крем с керамидами для сухой кожи.',
      description:
        'Увлажняющий крем для сухой и очень сухой кожи с тремя керамидами и гиалуроновой кислотой. Без ароматизаторов, не комедогенный.',
      activeIngredients: 'Керамиды NP, AP, EOP; гиалуроновая кислота; глицерин',
      warnings:
        'Только для наружного применения. Избегайте попадания в глаза. При выраженном покраснении прекратите использование. ' + L_RU,
    },
  },
  {
    sku: 'ILK-NIVEA-SOFT', slug: 'nivea-soft-cream-200ml', barcode: '4820000100183',
    name: 'Nivea Soft тос 200 мл', nameEn: 'Nivea Soft cream 200 ml', nameRu: 'Nivea Soft крем 200 мл',
    category: 'goo-saihan', brand: 'nivea', manufacturer: 'beiersdorf-ag',
    rx: false, price: 22000, discountPrice: 18700, stock: 132, art: 'cosmetic',
    packageSize: '200 мл', dosageForm: 'Тос',
    expiryMonths: 30, weightGrams: 230,
    soldCount: 214, shelf: 'C-05',
    mn: {
      short: 'Нүүр, гар, биед зориулсан хөнгөн чийгшүүлэх тос.',
      description:
        'Жоожой шимэгддэг, хөнгөн бүтэцтэй чийгшүүлэх тос. Хайлмал тос, витамин E агуулна. Нүүр, гар, биед хэрэглэхэд тохиромжтой, өдөр тутмын арчилгаанд.',
      ingredients: 'Ус, глицерин, jojoba тос, витамин E (токоферил ацетат), глицерил стеарат, үнэрт бодис.',
      activeIngredients: 'Jojoba тос, витамин E',
      dosage: '—',
      usage: 'Цэвэр, хуурай арьсанд шаардлагатай үед түрхэнэ.',
      warnings: 'Зөвхөн гадуур хэрэглэнэ. Нүдэнд орохоос сэрэмжил. Үнэрт бодис агуулсан тул харшилтай хүн найрлагыг шалгана.',
      sideEffects: 'Хааяа харшлын шинж, улайлт.',
      storage: 'Хэвийн температурт хадгална.',
    },
    en: {
      short: 'Light moisturiser for face, hands and body.',
      description:
        'A light, fast-absorbing moisturising cream with jojoba oil and vitamin E, suitable for face, hands and body as part of a daily routine.',
      activeIngredients: 'Jojoba oil, vitamin E',
      dosage: '—',
      warnings: 'External use only. Avoid the eyes. Contains fragrance — check the ingredients if you have allergies.',
      storage: 'Store at room temperature.',
    },
    ru: {
      short: 'Лёгкий увлажняющий крем для лица, рук и тела.',
      description:
        'Лёгкий быстро впитывающийся увлажняющий крем с маслом жожоба и витамином E для лица, рук и тела.',
      activeIngredients: 'Масло жожоба, витамин E',
      warnings: 'Только наружно. Избегайте попадания в глаза. Содержит ароматизаторы.',
    },
  },
  {
    sku: 'ILK-BABY-PARA', slug: 'huuhdiin-paracetamol-syrup', barcode: '4820000100190',
    name: 'Хүүхдийн парацетамол сироп 120 мг/5 мл', nameEn: "Children's paracetamol syrup 120 mg/5 ml", nameRu: 'Детский парацетамол сироп 120 мг/5 мл',
    category: 'huuhdiin-buteegdehuun', brand: 'monos-pharma', manufacturer: 'monos-group',
    rx: false, price: 8900, stock: 108, art: 'syrup',
    packageSize: '100 мл', dosageForm: 'Сироп', strength: '120 мг/5 мл',
    registrationNo: 'ЭМ-2021/0203', expiryMonths: 16, weightGrams: 155,
    featured: true, soldCount: 297, shelf: 'B-01',
    mn: {
      short: 'Хүүхдийн халуун бууруулах, өвдөлт намдаах сироп.',
      description:
        'Хүүхдийн халууралт, өвдөлтийн үед хэрэглэх парацетамолын сироп. Хэмжих шпринц дагалдана. Хүүхдийн тун нь жин, наснаас хамаардаг тул фармацевт, эмчээс тодруулах шаардлагатай.',
      ingredients: 'Парацетамол 120 мг/5 мл, сорбитол, глицерин, цитрын хүчил, гүзээлзгэнэний үнэр, цэвэршүүлсэн ус.',
      activeIngredients: 'Парацетамол (paracetamol) 120 мг/5 мл',
      dosage:
        'Тунг жингээр тооцно (ерөнхийдөө 10-15 мг/кг, 4-6 цагийн зайтай, хоногт 4 удаагаас илүүгүй). Яг тунг фармацевт, эмчээс тодруулна. 3-аас доош сартай хүүхдэд эмчийн зөвлөгөөгүй хэрэглэхгүй.',
      usage: 'Сэгсэрч, дагалдах шпринцээр тунг хэмжинэ. Халбагаар хэмжихгүй — тун зөрөх эрсдэлтэй.',
      warnings:
        'Парацетамол агуулсан бусад эмтэй (ханиадны хавсарсан эм гэх мэт) хамт хэрэглэвэл тун хэтрэх эрсдэлтэй. Халуун 3 хоногоос дээш үргэлжилбэл, 3 сараас доош насны хүүхэд халуурвал, хүүхэд эрдэс шингэн авахгүй, гүжирсэн байвал яаралтай эмчид хандана. Элэгний эмгэгтэй хүүхдэд эмчийн хяналттай. ' + L_MN,
      sideEffects: 'Хааяа арьсны тууралт, дотор муухайрах.',
      storage: '25°C-аас доош. Нээсний дараа 1 сарын дотор хэрэглэнэ. Хүүхдийн хүрэхээргүй байлга.',
    },
    en: {
      short: "Children's syrup for fever and pain.",
      description:
        'Paracetamol syrup for fever and pain in children, supplied with a dosing syringe. Paediatric dosing depends on weight and age and must be confirmed with a pharmacist or doctor.',
      activeIngredients: 'Paracetamol 120 mg/5 ml',
      dosage:
        'Dosed by weight (generally 10-15 mg/kg every 4-6 hours, maximum four doses in 24 hours). Confirm the exact dose with a pharmacist. Not for infants under 3 months without medical advice.',
      warnings:
        'Combining with other paracetamol-containing products (such as combination cold remedies) risks an overdose. Seek urgent care if fever lasts over three days, in any fever under 3 months of age, or if the child is not drinking or is drowsy. ' + L_EN,
      storage: 'Below 25°C. Use within one month of opening. Keep out of reach of children.',
    },
    ru: {
      short: 'Детский сироп при температуре и боли.',
      description:
        'Сироп парацетамола при температуре и боли у детей, с мерным шприцем. Доза зависит от веса и возраста — уточните у фармацевта или врача.',
      activeIngredients: 'Парацетамол 120 мг/5 мл',
      warnings:
        'Совместный приём с другими средствами, содержащими парацетамол, опасен передозировкой. При температуре дольше трёх дней срочно к врачу. ' + L_RU,
    },
  },
  {
    sku: 'ILK-ORS-SACH', slug: 'ors-rehydration-sachets', barcode: '4820000100206',
    name: 'ORS нөхөн сэргээх шингэний нунтаг', nameEn: 'ORS rehydration sachets', nameRu: 'ОРС порошок для регидратации',
    category: 'anhny-tuslamts', brand: 'asian-pharma', manufacturer: 'asian-pharma-llc',
    rx: false, price: 5400, stock: 210, art: 'firstaid',
    packageSize: '10 нунтаг', dosageForm: 'Ууна нунтаг',
    registrationNo: 'ЭМ-2021/0344', expiryMonths: 27, weightGrams: 120,
    soldCount: 176, shelf: 'B-08',
    mn: {
      short: 'Суулгалт, бөөлжилтийн үед шингэн, электролит нөхөх нунтаг.',
      description:
        'Дэлхийн эрүүл мэндийн байгууллагын зөвлөмжид үндэслэсэн найрлагатай, суулгалт, бөөлжилт, халуун, хөлс их гарсны дараа биеийн шингэн, электролитийг нөхөх зорилготой ууна нунтаг.',
      ingredients: 'Натрийн хлорид, калийн хлорид, натрийн цитрат, глюкоз (нэг нунтагт).',
      activeIngredients: 'Натри, кали, цитрат, глюкоз (электролитийн хольц)',
      dosage:
        'Нэг нунтгийг 200 мл цэвэр усанд уусгана. Насанд хүрэгчид, хүүхдийн хэрэглэх хэмжээ нь шингэн хомсдлын зэргээс хамаарна — фармацевт, эмчээс тодруулна.',
      usage: 'Цэвэр, хөрсөн усанд бүрэн уусгаж, бага багаар, тасралтгүй ууна. Уусмалыг 24 цагийн дотор хэрэглэнэ.',
      warnings:
        'Хүүхэд, өндөр настан, архаг өвчтэй хүнд шингэн хомсдол хурдан хүндэрдэг. Хүүхэд шээхээ болих, ам хатах, гүжрэх, бөөлжилт зогсохгүй байх, бааж цустай байвал яаралтай эмнэлэгт хандана. Бөөр, зүрхний эмгэгтэй хүн эмчээс зөвлөгөө авна.',
      sideEffects: 'Хэт их хэрэглэвэл дотор муухайрах, бөөлжих.',
      storage: 'Хуурай, 25°C-аас доош газар хадгална.',
    },
    en: {
      short: 'Oral rehydration powder for diarrhoea and vomiting.',
      description:
        'Oral rehydration salts with a WHO-aligned composition, for replacing fluid and electrolytes after diarrhoea, vomiting, fever or heavy sweating.',
      activeIngredients: 'Sodium, potassium, citrate and glucose electrolyte blend',
      dosage:
        'Dissolve one sachet in 200 ml of clean water. The volume needed depends on the degree of dehydration — ask a pharmacist or doctor.',
      warnings:
        'Dehydration escalates quickly in children, older adults and people with chronic illness. Seek urgent care if a child stops passing urine, has a dry mouth, is drowsy, cannot keep fluids down, or has blood in the stool. ' + L_EN,
      storage: 'Store in a dry place below 25°C.',
    },
    ru: {
      short: 'Порошок для регидратации при диарее и рвоте.',
      description:
        'Соли для оральной регидратации по рекомендациям ВОЗ — восполнение жидкости и электролитов после диареи, рвоты, лихорадки.',
      activeIngredients: 'Натрий, калий, цитрат, глюкоза',
      warnings:
        'У детей и пожилых обезвоживание нарастает быстро. При отсутствии мочи, сухости во рту, сонливости — срочно к врачу. ' + L_RU,
    },
  },
  {
    sku: 'ILK-HART-PLAST', slug: 'hartmann-plaster-set', barcode: '4820000100213',
    name: 'Hartmann шархны боолтны хэрэгсэл', nameEn: 'Hartmann wound dressing set', nameRu: 'Набор перевязочных средств Hartmann',
    category: 'anhny-tuslamts', brand: 'hartmann', manufacturer: 'paul-hartmann',
    rx: false, price: 26500, stock: 76, art: 'firstaid',
    packageSize: '1 хэрэгсэл (40 хэсэг)', dosageForm: 'Боолтны хэрэгсэл',
    expiryMonths: 48, weightGrams: 320,
    soldCount: 91, shelf: 'B-09',
    mn: {
      short: 'Гэр, ажлын байрны анхны тусламжийн боолтны хэрэгсэл.',
      description:
        'Жижиг шарх, зүсэлт, түлэгдэлтийн анхны тусламжид шаардлагатай боолт, наалт, самбай, антисептик арчдас, хайчийг нэг гэрт цуглуулсан хэрэгсэл. Гэр, машин, ажлын байранд байлгахад зохимжтой.',
      ingredients: 'Наалт (олон хэмжээ), стерил самбай, эластик боолт, антисептик арчдас, хайч, хуруувч, гар хамгаалах бээлий.',
      activeIngredients: '—',
      dosage: '—',
      usage:
        'Шархыг цэвэр усаар зайлж, антисептик арчдасаар цэвэрлээд, хэмжээнд тохирсон наалт эсвэл самбайгаар хучина. Боолтыг өдөрт 1 удаа, эсвэл бохирдвол сольж байна.',
      warnings:
        'Гүн, урт, өөрөө зогсохгүй цус гоожсон шарх, амьтны хазуулга, зэвэрсэн металлын гэмтэл, өргөн түлэгдэлт тохиолдвол өөрөө боохгүйгээр эмнэлэгт хандана. Шарх улайх, хавдах, өтгөн шүүрэлт үүсэх нь халдварын шинж — эмчид хандана. Татрангийн вакцины хугацааг эмчээс тодруулна.',
      sideEffects: 'Наалтын цавуунд арьс мэдрэмтгий хүн улайх тохиолдол гарна.',
      storage: 'Хуурай, цэвэр газар. Стерил хэсгийн савлагаа бүтэн эсэхийг хэрэглэхийн өмнө шалгана.',
    },
    en: {
      short: 'First-aid dressing kit for home and workplace.',
      description:
        'A single kit containing the plasters, sterile gauze, elastic bandage, antiseptic wipes and scissors needed for first aid on minor wounds, cuts and burns. Suited to a home, car or workplace kit.',
      activeIngredients: '—',
      dosage: '—',
      warnings:
        'For deep or long wounds, bleeding that does not stop, animal bites, injuries from rusty metal, or extensive burns, go to a medical facility rather than dressing it yourself. Redness, swelling or thick discharge indicates infection — see a doctor. Check your tetanus vaccination status with a doctor. ' + L_EN,
      storage: 'Keep clean and dry. Check that sterile packaging is intact before use.',
    },
    ru: {
      short: 'Набор первой помощи для дома и работы.',
      description:
        'Набор с пластырями, стерильными салфетками, эластичным бинтом, антисептическими салфетками и ножницами для первой помощи при небольших ранах, порезах и ожогах.',
      activeIngredients: '—',
      warnings:
        'При глубоких ранах, непрекращающемся кровотечении, укусах животных, обширных ожогах обратитесь в медучреждение. Покраснение и гнойное отделяемое — признак инфекции. ' + L_RU,
    },
  },
]
