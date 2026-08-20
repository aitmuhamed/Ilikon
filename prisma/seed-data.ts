/**
 * Demo catalogue for Иликон (Уужим Эмийн Сан).
 *
 * The product copy describes what each item is, how it is taken and what to
 * watch out for, in the register a Mongolian pharmacy actually uses. It makes
 * no efficacy claims and every entry defers to the leaflet and a pharmacist.
 */

export interface SeedCategory {
  slug: string
  name: string
  nameEn: string
  nameRu: string
  icon: string
  art: string
  parent?: string
  sortOrder: number
  featured?: boolean
}

export const CATEGORIES: SeedCategory[] = [
  { slug: 'em', name: 'Эм', nameEn: 'Medicines', nameRu: 'Лекарства', icon: 'pill', art: 'pill', sortOrder: 10, featured: true },
  { slug: 'joroor-olgoh-em', name: 'Жороор олгох эм', nameEn: 'Prescription medicines', nameRu: 'Рецептурные лекарства', icon: 'file', art: 'pill', parent: 'em', sortOrder: 11 },
  { slug: 'jorgui-em', name: 'Жоргүй эм', nameEn: 'Over-the-counter medicines', nameRu: 'Безрецептурные лекарства', icon: 'pill', art: 'pill', parent: 'em', sortOrder: 12 },
  { slug: 'uvdult-namdaah', name: 'Өвдөлт намдаах', nameEn: 'Pain relief', nameRu: 'Обезболивающие', icon: 'activity', art: 'pill', parent: 'em', sortOrder: 13, featured: true },
  { slug: 'haniad-tomuu', name: 'Ханиад, томуу', nameEn: 'Cold & flu', nameRu: 'Простуда и грипп', icon: 'thermometer', art: 'syrup', parent: 'em', sortOrder: 14, featured: true },
  { slug: 'harshil', name: 'Харшил', nameEn: 'Allergy', nameRu: 'Аллергия', icon: 'wind', art: 'pill', parent: 'em', sortOrder: 15 },
  { slug: 'hool-bolovsruulah', name: 'Хоол боловсруулах', nameEn: 'Digestive health', nameRu: 'Пищеварение', icon: 'utensils', art: 'syrup', parent: 'em', sortOrder: 16 },
  { slug: 'vitamin', name: 'Витамин', nameEn: 'Vitamins', nameRu: 'Витамины', icon: 'sun', art: 'vitamin', sortOrder: 20, featured: true },
  { slug: 'darhlaa-demjih', name: 'Дархлаа дэмжих', nameEn: 'Immune support', nameRu: 'Поддержка иммунитета', icon: 'shield', art: 'vitamin', parent: 'vitamin', sortOrder: 21, featured: true },
  { slug: 'aris-archilgaa', name: 'Арьс арчилгаа', nameEn: 'Skin care', nameRu: 'Уход за кожей', icon: 'sparkles', art: 'cream', sortOrder: 30, featured: true },
  { slug: 'huuhdiin-buteegdehuun', name: 'Хүүхдийн бүтээгдэхүүн', nameEn: 'Baby & child', nameRu: 'Детские товары', icon: 'baby', art: 'baby', sortOrder: 40, featured: true },
  { slug: 'ehiin-buteegdehuun', name: 'Эхийн бүтээгдэхүүн', nameEn: 'Maternity', nameRu: 'Товары для мам', icon: 'heart', art: 'baby', sortOrder: 45 },
  { slug: 'eruul-mendiin-heregsel', name: 'Эрүүл мэндийн хэрэгсэл', nameEn: 'Medical devices', nameRu: 'Медицинские приборы', icon: 'stethoscope', art: 'device', sortOrder: 50, featured: true },
  { slug: 'daralt-hemjigch', name: 'Даралт хэмжигч', nameEn: 'Blood pressure monitors', nameRu: 'Тонометры', icon: 'gauge', art: 'device', parent: 'eruul-mendiin-heregsel', sortOrder: 51 },
  { slug: 'termometr', name: 'Термометр', nameEn: 'Thermometers', nameRu: 'Термометры', icon: 'thermometer', art: 'thermometer', parent: 'eruul-mendiin-heregsel', sortOrder: 52 },
  { slug: 'anhny-tuslamts', name: 'Анхны тусламж', nameEn: 'First aid', nameRu: 'Первая помощь', icon: 'cross', art: 'firstaid', parent: 'eruul-mendiin-heregsel', sortOrder: 53 },
  { slug: 'ariun-tsevriin-buteegdehuun', name: 'Ариун цэврийн бүтээгдэхүүн', nameEn: 'Hygiene', nameRu: 'Гигиена', icon: 'droplet', art: 'hygiene', sortOrder: 60 },
  { slug: 'goo-saihan', name: 'Гоо сайхан', nameEn: 'Beauty', nameRu: 'Красота', icon: 'flower', art: 'cosmetic', sortOrder: 70 },
  { slug: 'busad', name: 'Бусад', nameEn: 'Other', nameRu: 'Прочее', icon: 'package', art: 'pill', sortOrder: 99 },
]

export interface SeedBrand {
  slug: string
  name: string
  country: string
  description: string
}

export const BRANDS: SeedBrand[] = [
  { slug: 'monos-pharma', name: 'Monos Pharma', country: 'Монгол', description: 'Монголын эмийн үйлдвэрлэлийн томоохон компани. Бүртгэлтэй эм, био нэмэлт бүтээгдэхүүн.' },
  { slug: 'asian-pharma', name: 'Asian Pharma', country: 'Монгол', description: 'Монгол дахь эм, эмнэлгийн хэрэгслийн үйлдвэрлэл, импорт.' },
  { slug: 'krka', name: 'KRKA', country: 'Словени', description: 'Европын генерик эмийн үйлдвэрлэгч.' },
  { slug: 'sandoz', name: 'Sandoz', country: 'Швейцарь', description: 'Novartis группын генерик эмийн салбар.' },
  { slug: 'bayer', name: 'Bayer', country: 'Герман', description: 'Эм, эрүүл мэндийн бүтээгдэхүүний олон улсын үйлдвэрлэгч.' },
  { slug: 'gsk', name: 'GSK', country: 'Их Британи', description: 'Эм, вакцин, хэрэглээний эрүүл мэндийн бүтээгдэхүүн.' },
  { slug: 'solgar', name: 'Solgar', country: 'АНУ', description: 'Витамин, био нэмэлт тэжээлийн брэнд.' },
  { slug: 'nature-s-bounty', name: "Nature's Bounty", country: 'АНУ', description: 'Витамин, минерал, био нэмэлт бүтээгдэхүүн.' },
  { slug: 'omron', name: 'Omron', country: 'Япон', description: 'Цусны даралт хэмжигч, эрүүл мэндийн хэмжих хэрэгсэл.' },
  { slug: 'beurer', name: 'Beurer', country: 'Герман', description: 'Гэрийн эрүүл мэндийн хэмжих хэрэгсэл.' },
  { slug: 'bioderma', name: 'Bioderma', country: 'Франц', description: 'Дерматологийн арьс арчилгааны бүтээгдэхүүн.' },
  { slug: 'cerave', name: 'CeraVe', country: 'АНУ', description: 'Дерматологичдын хамт хөгжүүлсэн арьс арчилгаа.' },
  { slug: 'nivea', name: 'Nivea', country: 'Герман', description: 'Арьс арчилгаа, гоо сайхны бүтээгдэхүүн.' },
  { slug: 'chicco', name: 'Chicco', country: 'Итали', description: 'Хүүхэд, эхийн бүтээгдэхүүн.' },
  { slug: 'hartmann', name: 'Hartmann', country: 'Герман', description: 'Боолт, шарх арчилгааны материал.' },
]

export interface SeedManufacturer {
  slug: string
  name: string
  country: string
}

export const MANUFACTURERS: SeedManufacturer[] = [
  { slug: 'monos-group', name: 'Монос групп ХХК', country: 'Монгол' },
  { slug: 'asian-pharma-llc', name: 'Асиан фарма ХХК', country: 'Монгол' },
  { slug: 'krka-dd', name: 'KRKA d.d. Novo Mesto', country: 'Словени' },
  { slug: 'sandoz-gmbh', name: 'Sandoz GmbH', country: 'Австри' },
  { slug: 'bayer-ag', name: 'Bayer AG', country: 'Герман' },
  { slug: 'gsk-plc', name: 'GlaxoSmithKline plc', country: 'Их Британи' },
  { slug: 'solgar-inc', name: 'Solgar Inc.', country: 'АНУ' },
  { slug: 'omron-healthcare', name: 'Omron Healthcare Co., Ltd.', country: 'Япон' },
  { slug: 'beurer-gmbh', name: 'Beurer GmbH', country: 'Герман' },
  { slug: 'naos-bioderma', name: 'NAOS (Bioderma)', country: 'Франц' },
  { slug: 'loreal-cerave', name: "L'Oréal (CeraVe)", country: 'АНУ' },
  { slug: 'beiersdorf-ag', name: 'Beiersdorf AG', country: 'Герман' },
  { slug: 'artsana-chicco', name: 'Artsana S.p.A. (Chicco)', country: 'Итали' },
  { slug: 'paul-hartmann', name: 'Paul Hartmann AG', country: 'Герман' },
]
