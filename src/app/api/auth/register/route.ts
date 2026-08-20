import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { hashPassword, startSession } from '@/lib/auth'
import { registerSchema } from '@/lib/validation'
import { ROLE_KEYS } from '@/lib/rbac'
import { mergeGuestCart } from '@/lib/cart'
import { audit } from '@/lib/audit'
import { notifyCustomer } from '@/lib/notifications'

export const POST = route({
  auth: 'public',
  schema: registerSchema,
  rateLimit: 'register',
  skipCsrf: true, // anonymous visitor has no CSRF cookie yet
  async handler({ body, request }) {
    const existingPhone = await prisma.user.findUnique({ where: { phone: body.phone } })
    if (existingPhone) throw new ApiError(409, 'PHONE_TAKEN', 'This phone number is already registered')

    if (body.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: body.email } })
      if (existingEmail) throw new ApiError(409, 'EMAIL_TAKEN', 'This email is already registered')
    }

    const customerRole = await prisma.role.findUnique({ where: { key: ROLE_KEYS.CUSTOMER } })

    const user = await prisma.user.create({
      data: {
        fullName: body.fullName,
        phone: body.phone,
        email: body.email ?? null,
        passwordHash: await hashPassword(body.password),
        locale: body.locale ?? 'mn',
        marketingOptIn: body.marketingOptIn,
        isStaff: false,
        roleId: customerRole?.id ?? null,
        wishlist: { create: {} },
      },
    })

    await startSession(user.id)
    await mergeGuestCart(user.id)

    await notifyCustomer({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Тавтай морил!',
      body: 'Иликон Уужим Эмийн Санд бүртгэгдлээ. Одоо онлайнаар захиалга хийх боломжтой.',
      linkUrl: '/account',
    })

    await audit({
      action: 'auth.register',
      entity: 'User',
      entityId: user.id,
      summary: `New customer account ${user.fullName}`,
      request,
    })

    return ok({
      user: { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email },
    })
  },
})
