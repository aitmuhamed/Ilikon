import type { Metadata } from 'next'
import { Lock } from 'lucide-react'

import { Alert, Breadcrumbs, Card } from '@/components/ui/primitives'
import { getDictionary } from '@/i18n'
import { coerceLocale, type Locale } from '@/lib/locale-types'
import { getSettings } from '@/lib/settings'
import { buildMetadata } from '@/lib/seo'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  return buildMetadata({
    locale,
    title: d.footer.privacy,
    description: d.prescription.privacyNotice,
    pathWithoutLocale: '/privacy',
  })
}

/**
 * Privacy policy.
 *
 * Describes what this implementation actually collects and how prescription
 * data is protected. A working draft for the pharmacy's counsel to review.
 */
function content(locale: Locale, settings: Awaited<ReturnType<typeof getSettings>>) {
  if (locale === 'en') {
    return {
      updated: 'Last updated: 20 August 2026',
      sections: [
        {
          title: '1. Who controls your data',
          body: `${settings.pharmacyName} (${settings.pharmacyTagline}) is the controller of the personal data described here. For any privacy question, contact ${settings.email} or ${settings.phone}.`,
        },
        {
          title: '2. What we collect',
          body: 'Account data: your name, phone number, optional email, password (stored only as a bcrypt hash), preferred language and marketing consent. Order data: delivery address, order contents, payment method and status, and the order timeline. Prescription data: the file you upload plus any patient, doctor, clinic and date details you enter. Support data: chatbot conversations. Technical data: first-party analytics events keyed to a rotating anonymous session identifier.',
        },
        {
          title: '3. Health data and prescriptions',
          body: 'A prescription is health data and is treated as the most sensitive category we hold. Uploaded files are stored outside any publicly served directory, are never linked from a public URL, and are readable only through an authorised route. Access is limited to you and to staff holding the prescription permission — in practice, licensed pharmacists. Every single access, and every refused access, is written to an append-only audit log with the actor, time and IP address.',
        },
        {
          title: '4. Why we process it',
          body: 'To take, verify, prepare and deliver your order; to meet pharmacy record-keeping obligations; to answer your questions; to protect the service against fraud and abuse; and — only with your consent — to send promotional messages.',
        },
        {
          title: '5. Marketing consent',
          body: 'Promotional notifications and emails are sent only if you opt in. Withdrawing consent is a single toggle in your account and takes effect immediately. Order and prescription notifications are service messages and are not affected by that choice.',
        },
        {
          title: '6. Analytics',
          body: 'We use first-party analytics only: no third-party trackers, no advertising pixels, and no cross-site identifiers. Product views are recorded against a rotating anonymous session id for shop reporting; we do not build an advertising profile from health-related browsing.',
        },
        {
          title: '7. Who else sees your data',
          body: 'Payment providers receive the amount and order reference needed to process a payment — we never store your card number. Delivery staff see the delivery address and contact number for the order assigned to them. We do not sell personal data.',
        },
        {
          title: '8. How long we keep it',
          body: 'Order and prescription records are retained for the period pharmacy regulations require. Raw analytics events are pruned on a rolling basis. Closing your account removes your profile from the storefront while preserving the order and dispensing records the law requires us to keep.',
        },
        {
          title: '9. Security',
          body: 'Passwords are hashed with bcrypt. Sessions use signed, httpOnly cookies with CSRF protection. Uploads are validated by inspecting file contents rather than trusting the filename. Access is governed by role-based permissions, privileged actions are rate-limited and audit-logged, and the platform is designed to run behind HTTPS.',
        },
        {
          title: '10. Your rights',
          body: 'You can view and correct your profile and addresses in your account, download or ask for a copy of your data, withdraw marketing consent, and request deletion of data we are not legally required to retain. Contact us using the details above.',
        },
      ],
    }
  }

  if (locale === 'ru') {
    return {
      updated: 'Последнее обновление: 20 августа 2026 г.',
      sections: [
        {
          title: '1. Кто обрабатывает данные',
          body: `${settings.pharmacyName} (${settings.pharmacyTagline}) является оператором описанных здесь персональных данных. По вопросам конфиденциальности: ${settings.email}, ${settings.phone}.`,
        },
        {
          title: '2. Какие данные мы собираем',
          body: 'Данные профиля: имя, телефон, эл. почта (необязательно), пароль (только в виде bcrypt-хеша), язык и согласие на рассылку. Данные заказа: адрес доставки, состав заказа, способ и статус оплаты, история статусов. Данные рецепта: загруженный файл и указанные вами сведения о пациенте, враче, клинике и датах. Поддержка: диалоги с чат-ботом. Технические данные: собственная аналитика с ротируемым анонимным идентификатором сессии.',
        },
        {
          title: '3. Данные о здоровье и рецепты',
          body: 'Рецепт — это данные о здоровье, самая чувствительная категория. Загруженные файлы хранятся вне публичных каталогов, не имеют публичных ссылок и доступны только через авторизованный маршрут. Доступ есть у вас и у сотрудников с правом на рецепты — фактически у лицензированных фармацевтов. Каждое обращение и каждый отказ фиксируются в журнале аудита с указанием сотрудника, времени и IP.',
        },
        {
          title: '4. Цели обработки',
          body: 'Приём, проверка, сборка и доставка заказа; выполнение требований аптечного учёта; ответы на ваши вопросы; защита сервиса от мошенничества; и только с вашего согласия — рекламные сообщения.',
        },
        {
          title: '5. Согласие на рассылку',
          body: 'Рекламные уведомления отправляются только при вашем согласии. Отозвать согласие можно одним переключателем в профиле — изменение действует сразу. Служебные уведомления о заказе и рецепте от этого выбора не зависят.',
        },
        {
          title: '6. Аналитика',
          body: 'Используется только собственная аналитика: без сторонних трекеров, рекламных пикселей и межсайтовых идентификаторов. Просмотры товаров учитываются по ротируемому анонимному идентификатору сессии; рекламный профиль на основе медицинских интересов не строится.',
        },
        {
          title: '7. Кому передаются данные',
          body: 'Платёжные провайдеры получают сумму и номер заказа для обработки платежа — номер карты мы не храним. Курьеры видят адрес и контактный телефон только по назначенному им заказу. Персональные данные не продаются.',
        },
        {
          title: '8. Сроки хранения',
          body: 'Записи о заказах и рецептах хранятся в течение срока, требуемого аптечным регулированием. Сырые события аналитики удаляются по расписанию. При закрытии профиля он удаляется из витрины, но учётные записи об отпуске лекарств сохраняются согласно закону.',
        },
        {
          title: '9. Безопасность',
          body: 'Пароли хешируются bcrypt. Сессии используют подписанные httpOnly-cookie и защиту от CSRF. Загрузки проверяются по содержимому файла, а не по имени. Доступ разграничен ролями, привилегированные действия ограничены по частоте и фиксируются в журнале аудита; платформа рассчитана на работу через HTTPS.',
        },
        {
          title: '10. Ваши права',
          body: 'Вы можете просматривать и исправлять профиль и адреса, запросить копию данных, отозвать согласие на рассылку и потребовать удаления данных, которые мы не обязаны хранить по закону.',
        },
      ],
    }
  }

  return {
    updated: 'Хамгийн сүүлд шинэчлэгдсэн: 2026 оны 8 дугаар сарын 20',
    sections: [
      {
        title: '1. Өгөгдлийг хэн хариуцдаг',
        body: `${settings.pharmacyName} (${settings.pharmacyTagline}) нь энд тайлбарласан хувийн өгөгдлийг хариуцагч юм. Нууцлалын талаарх асуултаа ${settings.email} эсвэл ${settings.phone} дугаараар холбогдож тавина уу.`,
      },
      {
        title: '2. Ямар өгөгдөл цуглуулдаг',
        body: 'Хаягийн өгөгдөл: нэр, утасны дугаар, и-мэйл (сонголтоор), нууц үг (зөвхөн bcrypt хэш хэлбэрээр), хэлний сонголт, урамшууллын зөвшөөрөл. Захиалгын өгөгдөл: хүргэлтийн хаяг, захиалгын агуулга, төлбөрийн хэлбэр, төлөв, захиалгын хөдөлгөөн. Жорын өгөгдөл: хуулсан файл, түүнчлэн та оруулсан өвчтөн, эмч, эмнэлэг, огнооны мэдээлэл. Тусламжийн өгөгдөл: чатботын харилцаа. Техникийн өгөгдөл: тогтмол шинэчлэгддэг анонимаар түлхүүрлэсэн дотоод аналитикийн үйл явдал.',
      },
      {
        title: '3. Эрүүл мэндийн өгөгдөл ба жор',
        body: 'Жор нь эрүүл мэндийн өгөгдөл бөгөөд бидний хадгалдаг хамгийн эмзэг категори юм. Хуулсан файлыг олон нийтэд нээлттэй сан дотор хадгалахгүй, олон нийтийн хаягаар хэзээ ч холбохгүй, зөвхөн эрх шалгасан замаар нээх боломжтой. Хандах эрх зөвхөн танд болон жорын эрх бүхий ажилтан — бодит хэрэглээнд эрх бүхий фармацевтад байна. Хандалт бүр, түүнчлэн татгалзсан хандалт бүр нь ажилтан, цаг, IP хаягтай хамт зөвхөн нэмэгддэг аудит логт бүртгэгдэнэ.',
      },
      {
        title: '4. Ямар зорилгоор боловсруулдаг',
        body: 'Захиалгыг хүлээн авах, баталгаажуулах, бэлтгэх, хүргэх; эмийн сангийн бүртгэлийн шаардлагыг биелүүлэх; асуултад хариулах; үйлчилгээг хууль бус ашиглалтаас хамгаалах; мөн зөвхөн таны зөвшөөрлөөр урамшууллын мэдээлэл илгээх зорилгоор.',
      },
      {
        title: '5. Урамшууллын зөвшөөрөл',
        body: 'Урамшууллын мэдэгдэл, и-мэйлийг зөвхөн та зөвшөөрсөн тохиолдолд илгээнэ. Зөвшөөрлөө хаягийн тохиргооноос нэг дарааж цуцалж болох бөгөөд шууд хүчин төгөлдөр болно. Захиалга, жорын мэдэгдэл нь үйлчилгээний мэдэгдэл бөгөөд энэ сонголтод хамаарахгүй.',
      },
      {
        title: '6. Аналитик',
        body: 'Зөвхөн дотоод аналитик хэрэглэдэг: гуравдагч талын хянагч, зар суртчилгааны пиксел, сайт хооронд дамждаг танигч байхгүй. Бүтээгдэхүүний үзэлтийг дэлгүүрийн тайлангийн зорилгоор тогтмол шинэчлэгддэг анонимаар бүртгэдэг; эрүүл мэндтэй холбоотой хайлтаас зар суртчилгааны хувийн профайл бүрдүүлэхгүй.',
      },
      {
        title: '7. Хэн өгөгдлийг харах боломжтой',
        body: 'Төлбөрийн үйлчилгээ үзүүлэгч төлбөрийг боловсруулахад шаардлагатай дүн, захиалгын дугаарыг хүлээн авна — картын дугаарыг бид хадгалахгүй. Хүргэлтийн ажилтан зөвхөн өөрт хуваарилагдсан захиалгын хаяг, холбоо барих дугаарыг харна. Хувийн өгөгдлийг бид зардаггүй.',
      },
      {
        title: '8. Хадгалах хугацаа',
        body: 'Захиалга, жорын бүртгэлийг эмийн сангийн журамд заасан хугацаанд хадгална. Аналитикийн түүхий бүртгэлийг тогтмол хугацаанд шүүрддэг. Хаягаа хаах нь профайлыг дэлгүүрээс хасах боловч хуулиар хадгалах шаардлагатай захиалга, олголтын бүртгэлийг хадгална.',
      },
      {
        title: '9. Аюулгүй байдал',
        body: 'Нууц үгийг bcrypt-ээр хэшлэнэ. Сешн нь гарын үсэгтэй httpOnly cookie, CSRF хамгаалалттай. Хуулсан файлыг файлын нэрд бус агуулгад шалгалт хийж баталгаажуулна. Хандалтыг дүрд үндэслэсэн эрхээр хязгаарлаж, эрх бүхий үйлдлийг давтамжаар хязгаарлан аудит логт бүртгэнэ. Платформ HTTPS-ийн доор ажиллахаар зохиогдсон.',
      },
      {
        title: '10. Таны эрх',
        body: 'Та хаягийн тохиргооноос профайл, хаягаа харах, зөв болгох, өгөгдлийн хуулбар хүсэх, урамшууллын зөвшөөрлөө цуцлах, хуулиар хадгалах шаардлагагүй өгөгдлийг устгуулах хүсэлт гаргах эрхтэй. Дээрх холбоо барих хаягаар хандана уу.',
      },
    ],
  }
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = coerceLocale((await params).locale)
  const d = getDictionary(locale)
  const settings = await getSettings()
  const text = content(locale, settings)

  return (
    <div className="container-page py-6 lg:py-10">
      <Breadcrumbs
        className="mb-4"
        items={[{ label: d.common.home, href: `/${locale}` }, { label: d.footer.privacy }]}
      />

      <div className="mx-auto max-w-3xl">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Lock className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{d.footer.privacy}</h1>
            <p className="mt-1 text-sm text-ink-400">{text.updated}</p>
          </div>
        </div>

        <Alert tone="brand" className="mt-5">
          {d.prescription.privacyNotice}
        </Alert>

        <Card className="mt-5 space-y-6">
          {text.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-semibold text-ink-900">{section.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{section.body}</p>
            </section>
          ))}
        </Card>
      </div>
    </div>
  )
}
