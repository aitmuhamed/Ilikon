/**
 * Seed entry point.
 *
 * Idempotent: every step upserts or checks for existing rows, so `npm run
 * db:seed` can be re-run against a populated database without duplicating
 * orders, reviews or analytics.
 */
import {
  prisma,
  DEMO_PASSWORD,
  ALL_PRODUCTS,
  daysAgo,
  seedAccessControl,
  seedTaxonomy,
  seedProducts,
  seedUsers,
  seedCommerceExtras,
  seedSettings,
} from './seed-core'
import {
  seedOrders,
  seedReviews,
  seedNotifications,
  seedAnalytics,
  seedChatbot,
} from './seed-orders'
import { seedConsultationKnowledge, seedDemoConsultations } from './seed-consultation'

async function main() {
  console.log('\n🏥  Иликон (Уужим Эмийн Сан) — seeding demo data\n')

  console.log('→ access control')
  await seedAccessControl()

  console.log('→ settings')
  await seedSettings()

  console.log('→ taxonomy')
  await seedTaxonomy()

  console.log('→ products')
  await seedProducts()

  console.log('→ users')
  await seedUsers()

  console.log('→ coupons & promotions')
  await seedCommerceExtras()

  console.log('→ orders')
  await seedOrders({ prisma, daysAgo })

  console.log('→ reviews')
  await seedReviews({ prisma, daysAgo })

  console.log('→ notifications')
  await seedNotifications({ prisma, daysAgo })

  console.log('→ analytics')
  await seedAnalytics({ prisma, daysAgo })

  console.log('→ chatbot')
  await seedChatbot({ prisma, daysAgo })

  console.log('→ consultation knowledge base')
  await seedConsultationKnowledge()

  console.log('→ demo consultations')
  await seedDemoConsultations()

  const [products, orders, customers, staff] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count({ where: { isStaff: false } }),
    prisma.user.count({ where: { isStaff: true } }),
  ])

  console.log(`
✅  Seed complete
    ${products} products · ${orders} orders · ${customers} customers · ${staff} staff accounts
    (${ALL_PRODUCTS.length} products defined in prisma/seed-products-*.ts)

🔑  Demo accounts — password for all: ${DEMO_PASSWORD}

    Super Admin        admin@ilikon.mn        99110001
    Admin              manager@ilikon.mn      99110002
    Pharmacist         pharmacist@ilikon.mn   99110003   ← can verify prescriptions
    Pharmacist         pharmacist2@ilikon.mn  99110004
    Inventory Manager  inventory@ilikon.mn    99110005
    Order Manager      orders@ilikon.mn       99110006
    Delivery Staff     delivery@ilikon.mn     99110007

    Customer           delgermaa@example.mn   88220001
    Customer           ganzorig@example.mn    88220002

    Storefront  →  http://localhost:3000/mn
    Admin       →  http://localhost:3000/admin

⚠️   Demo credentials only. Rotate every password and AUTH_SECRET before deploying.
`)
}

main()
  .catch((error) => {
    console.error('\n❌  Seed failed:\n', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
