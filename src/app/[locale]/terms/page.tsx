import type { Metadata } from 'next'

import { Alert, Breadcrumbs, Card } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale, type Locale } from '@/lib/locale-types'
import { getSettings, localizedAddress } from '@/lib/settings'
import { buildMetadata } from '@/lib/seo'
import { formatMnt } from '@/lib/utils'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.footer.terms,
    description: d.footer.terms,
    pathWithoutLocale: '/terms',
  })
}

/**
 * Terms of service.
 *
 * Written as a working draft that reflects how this platform actually behaves
 * (order flow, prescription handling, returns). It is not legal advice — the
 * pharmacy's counsel should review it before launch.
 */
function content(locale: Locale, settings: Awaited<ReturnType<typeof getSettings>>) {
  const address = localizedAddress(settings, locale)
  const fee = formatMnt(settings.deliveryFee, locale)
  const threshold = formatMnt(settings.freeDeliveryThreshold, locale)

  if (locale === 'en') {
    return {
      updated: 'Last updated: 20 August 2026',
      draftNote:
        'This is a working draft that describes how the platform operates. It must be reviewed by the pharmacy’s legal counsel before it is relied on.',
      sections: [
        {
          title: '1. Who we are',
          body: `${settings.pharmacyName} (${settings.pharmacyTagline}) operates a licensed pharmacy at ${address}, under health authority licence № ${settings.licenseNumber}. Contact: ${settings.phone}, ${settings.email}.`,
        },
        {
          title: '2. What this website does',
          body: 'The website lets you browse the pharmacy’s catalogue, place an order for delivery or pharmacy pickup, upload a prescription for pharmacist verification, and track the status of your order. It does not provide medical diagnosis, treatment or prescribing.',
        },
        {
          title: '3. Medical information disclaimer',
          body: 'Product descriptions, ingredient lists and dosage information reproduce package-level information for reference. They do not replace the package leaflet, a medical examination, or advice from a doctor or pharmacist. Always read the leaflet and consult a professional before using any medicine.',
        },
        {
          title: '4. Prescription medicines',
          body: 'Products marked “Prescription required” are dispensed only against a valid prescription issued by a licensed prescriber, and only after a licensed pharmacist has verified it. Verification is never automatic. We may reject a prescription that is expired, illegible, altered, or does not match the order, and we may contact you for clarification. Placing an order does not by itself entitle you to receive a prescription-only medicine.',
        },
        {
          title: '5. Orders and pricing',
          body: `Each order receives a unique number in the form ILK-YYYYMMDD-NNNN. Prices are shown in Mongolian tögrög and include any stated discount. Standard delivery within Ulaanbaatar is ${fee}; orders above ${threshold} qualify for free delivery. Pharmacy pickup is free. We may decline or cancel an order where stock is unavailable, a price was displayed in error, or a required prescription is not verified.`,
        },
        {
          title: '6. Payment',
          body: 'You may pay cash on delivery, by bank transfer, by card, or with QPay where enabled. Card and wallet payments are processed by the payment provider; we do not store card details. For bank transfers, quote your order number as the payment reference.',
        },
        {
          title: '7. Delivery',
          body: `We deliver within Ulaanbaatar during working hours (${settings.workingHoursWeekdays}). Estimated times are ${settings.deliveryEtaCentre} hours in the city centre and ${settings.deliveryEtaOuter} hours in outer districts. Orders placed outside working hours are prepared on the next working day. Someone must be available to receive the order at the address given.`,
        },
        {
          title: '8. Cancellation',
          body: 'You may cancel an order from your account until it moves to “Preparing”. After that, contact us by phone and we will help where the order has not yet been dispatched. Cancelled orders release any coupon used back to your account.',
        },
        {
          title: '9. Returns',
          body: 'For health and safety reasons, medicines and opened products cannot be returned or exchanged. If an item arrives damaged, incorrect, incomplete, or past its expiry date, contact us immediately and we will replace it or refund it.',
        },
        {
          title: '10. Your account',
          body: 'You are responsible for keeping your password confidential and for activity under your account. Tell us at once if you suspect unauthorised use. We may suspend an account used for fraud, abuse, or attempts to obtain prescription medicines improperly.',
        },
        {
          title: '11. Acceptable use',
          body: 'Do not attempt to interfere with the website, scrape it at scale, submit false prescriptions, or misrepresent your identity. Such use may be reported to the relevant authorities.',
        },
        {
          title: '12. Changes',
          body: 'We may update these terms. The version shown on this page at the time you place an order is the one that applies to that order.',
        },
      ],
    }
  }

  if (locale === 'ru') {
    return {
      updated: 'Последнее обновление: 20 августа 2026 г.',
      draftNote:
        'Это рабочий проект, описывающий фактическую работу платформы. Перед применением он должен быть проверен юристом аптеки.',
      sections: [
        {
          title: '1. Кто мы',
          body: `${settings.pharmacyName} (${settings.pharmacyTagline}) — лицензированная аптека по адресу ${address}, лицензия органа здравоохранения № ${settings.licenseNumber}. Контакты: ${settings.phone}, ${settings.email}.`,
        },
        {
          title: '2. Назначение сайта',
          body: 'Сайт позволяет просматривать каталог аптеки, оформлять заказ с доставкой или самовывозом, загружать рецепт для проверки фармацевтом и отслеживать статус заказа. Сайт не оказывает медицинскую помощь и не назначает лечение.',
        },
        {
          title: '3. Отказ от медицинской ответственности',
          body: 'Описания товаров, состав и дозировки приводятся для ознакомления и не заменяют инструкцию по применению, осмотр врача или консультацию фармацевта. Перед применением обязательно прочитайте инструкцию и обратитесь к специалисту.',
        },
        {
          title: '4. Рецептурные лекарства',
          body: 'Товары с отметкой «По рецепту» отпускаются только при действующем рецепте и только после проверки лицензированным фармацевтом. Автоматическое подтверждение исключено. Мы можем отклонить рецепт с истёкшим сроком, неразборчивый, исправленный или не соответствующий заказу, а также запросить уточнение. Оформление заказа само по себе не даёт права на получение рецептурного лекарства.',
        },
        {
          title: '5. Заказы и цены',
          body: `Каждому заказу присваивается номер вида ILK-YYYYMMDD-NNNN. Цены указаны в тугриках и включают заявленную скидку. Стандартная доставка по Улан-Батору — ${fee}; при заказе выше ${threshold} доставка бесплатна. Самовывоз бесплатный. Мы можем отказать в заказе при отсутствии товара, ошибке в цене или непроверенном рецепте.`,
        },
        {
          title: '6. Оплата',
          body: 'Доступна оплата наличными при получении, банковским переводом, картой и через QPay. Платежи картой обрабатывает платёжный провайдер; данные карт мы не храним. При переводе указывайте номер заказа в назначении платежа.',
        },
        {
          title: '7. Доставка',
          body: `Доставка по Улан-Батору в рабочее время (${settings.workingHoursWeekdays}). Ориентировочно ${settings.deliveryEtaCentre} часа в центре и ${settings.deliveryEtaOuter} часа в отдалённых районах. Заказы вне рабочего времени собираются на следующий рабочий день.`,
        },
        {
          title: '8. Отмена',
          body: 'Отменить заказ можно в профиле, пока он не перешёл в статус «Собирается». Позже свяжитесь с нами по телефону. При отмене использованный промокод возвращается.',
        },
        {
          title: '9. Возврат',
          body: 'По требованиям здоровья и безопасности лекарства и открытые товары возврату и обмену не подлежат. При повреждении, ошибке, недокомплекте или истёкшем сроке годности сразу свяжитесь с нами — мы заменим товар или вернём деньги.',
        },
        {
          title: '10. Ваш профиль',
          body: 'Вы отвечаете за сохранность пароля и действия в вашем профиле. Немедленно сообщите нам о подозрении на несанкционированный доступ. Профиль может быть заблокирован при мошенничестве или попытках неправомерно получить рецептурные лекарства.',
        },
        {
          title: '11. Допустимое использование',
          body: 'Запрещено вмешиваться в работу сайта, массово выгружать данные, подавать поддельные рецепты или искажать свою личность.',
        },
        {
          title: '12. Изменения',
          body: 'Мы можем обновлять условия. К заказу применяется редакция, действовавшая на момент его оформления.',
        },
      ],
    }
  }

  return {
    updated: 'Хамгийн сүүлд шинэчлэгдсэн: 2026 оны 8 дугаар сарын 20',
    draftNote:
      'Энэ нь платформын бодит ажиллагааг тодорхойлсон ажлын хувилбар юм. Хэрэглэхээсээ өмнө эмийн сангийн хуулийн зөвлөхөөр хянуулах шаардлагатай.',
    sections: [
      {
        title: '1. Бидний тухай',
        body: `${settings.pharmacyName} (${settings.pharmacyTagline}) нь ${address} хаягт эрүүл мэндийн газрын № ${settings.licenseNumber} зөвшөөрлөөр үйл ажиллагаа явуулдаг бүртгэлтэй эмийн сан юм. Холбоо барих: ${settings.phone}, ${settings.email}.`,
      },
      {
        title: '2. Вэбсайтын зорилго',
        body: 'Вэбсайт нь эмийн сангийн бүтээгдэхүүнийг үзэх, хүргэлтээр эсвэл эмийн сангаас авахаар захиалах, жороо фармацевтын баталгаажуулалтад хуулах, захиалгын төлөв хянах боломжийг олгоно. Онош тавих, эмчилгээ тогтоох, эм заах үйлчилгээ үзүүлэхгүй.',
      },
      {
        title: '3. Эмнэлгийн мэдээллийн тайлбар',
        body: 'Бүтээгдэхүүний тайлбар, найрлага, тунгийн мэдээлэл нь савлагаан дээрх мэдээллийг танилцуулах зорилгоор дамжуулсан бөгөөд хайрцган дахь заавар, эмчийн үзлэг, фармацевтын зөвлөгөөг орлохгүй. Эм хэрэглэхээсээ өмнө зааврыг уншиж, мэргэжлийн хүнээс зөвлөгөө аваарай.',
      },
      {
        title: '4. Жороор олгох эм',
        body: '«Жороор олгоно» гэж тэмдэглэсэн бүтээгдэхүүнийг зөвхөн эрх бүхий эмчийн бичсэн хүчинтэй жор, эрх бүхий фармацевтын баталгаажуулалттайгаар олгоно. Баталгаажуулалт автоматаар хийгддэггүй. Хугацаа дууссан, уншигдахгүй, засварласан, захиалгатай тохирохгүй жорыг татгалзах, эсвэл тодруулга хүсэх эрхтэй. Захиалга хийсэн нь өөрөө жорын эм авах эрх бүрдүүлэхгүй.',
      },
      {
        title: '5. Захиалга ба үнэ',
        body: `Захиалга бүр ILK-YYYYMMDD-NNNN хэлбэрийн дугаар авна. Үнэ нь Монгол төгрөгөөр, зарласан хямдралыг тооцсон байна. Улаанбаатар хотын дотор стандарт хүргэлт ${fee}; ${threshold}-с дээш захиалгад хүргэлт үнэ төлбөргүй. Эмийн сангаас авахад хураамж байхгүй. Нөөц дууссан, үнэ андуурч харагдсан, шаардлагатай жор баталгаажаагүй тохиолдолд захиалгыг татгалзах, цуцлах эрхтэй.`,
      },
      {
        title: '6. Төлбөр',
        body: 'Хүргэлтээр бэлнээр, банкны шилжүүлэг, карт, QPay-ээр төлөх боломжтой. Картын төлбөрийг төлбөрийн үйлчилгээ үзүүлэгч боловсруулах бөгөөд бид картын мэдээллийг хадгалахгүй. Банкны шилжүүлгийн гүйлгээний утга дээр захиалгын дугаараа бичнэ.',
      },
      {
        title: '7. Хүргэлт',
        body: `Улаанбаатар хотын дотор ажлын цагаар (${settings.workingHoursWeekdays}) хүргэнэ. Хотын төвд ${settings.deliveryEtaCentre} цаг, гадна дүүрэгт ${settings.deliveryEtaOuter} цаг байхаар тооцоолдог. Ажлын цагаас гадуур хийсэн захиалгыг дараагийн ажлын өдөр бэлтгэнэ. Хүргэлтийг хүлээн авах хүн заасан хаяг дээр байх шаардлагатай.`,
      },
      {
        title: '8. Цуцлалт',
        body: 'Захиалга «Бэлтгэж байна» төлөвт орохоос өмнө хаягаараа нэвтэрч цуцлах боломжтой. Түүнээс хойш утсаар холбогдвол хүргэлтэнд гараагүй байх тохиолдолд бид тусална. Цуцлагдсан захиалганд хэрэглэсэн купон эргэж чөлөөлөгдөнө.',
      },
      {
        title: '9. Буцаалт',
        body: 'Эрүүл мэнд, аюулгүй байдлын шаардлагаар эм болон нээгдсэн бүтээгдэхүүнийг буцаах, солих боломжгүй. Тээвэрлэлтийн гэмтэл, солигдсон, дутуу, хугацаа дууссан бүтээгдэхүүн тохиолдвол шууд бидэнтэй холбогдоно уу — бид солих эсвэл төлбөрийг буцаана.',
      },
      {
        title: '10. Хэрэглэгчийн хаяг',
        body: 'Нууц үгээ бусдад дамжуулахгүй байх, хаягаараа хийгдсэн үйлдлийн төлөө хариуцлага хүлээх нь хэрэглэгчийн үүрэг. Зөвшөөрөлгүй хандалт гарсан гэж үзвэл нэн даруй бидэнд мэдэгдэнэ. Хууль бус ашиглалт, жорын эмийг зохисгүй аргаар авах гэсэн тохиолдолд хаягийг хаана.',
      },
      {
        title: '11. Зөвшөөрөгдөх хэрэглээ',
        body: 'Вэбсайтын ажиллагаанд халдах, өгөгдлийг бөөнөөр хуулах, хуурамч жор илгээх, өөрийн иргэний мэдээллийг зөрүүлэх зэрэг үйлдлийг хориглоно.',
      },
      {
        title: '12. Нөхцөлийн шинэчлэл',
        body: 'Нөхцөлийг шинэчилж болно. Захиалга хийсэн үед энэ хуудсанд байсан хувилбар нь тухайн захиалганд хамаарна.',
      },
    ],
  }
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const settings = await getSettings()
  const text = content(locale, settings)

  return (
    <div className="container-page py-6 lg:py-10">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: d.common.home, href: `/${locale}` }, { label: d.footer.terms }]}
      />

      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{d.footer.terms}</h1>
        <p className="mt-1.5 text-sm text-ink-400">{text.updated}</p>

        <Alert tone="info" className="mt-5">
          {text.draftNote}
        </Alert>

        <Card className="mt-5 space-y-6">
          {text.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-semibold text-ink-900">{section.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{section.body}</p>
            </section>
          ))}
        </Card>

        <Alert tone="warning" className="mt-5">
          {d.footer.disclaimer}
        </Alert>
      </div>
    </div>
  )
}
