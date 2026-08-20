import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { dummyPasswordCompare, startSession, verifyPassword } from '@/lib/auth'
import { loginSchema } from '@/lib/validation'
import { mergeGuestCart } from '@/lib/cart'
import { normalizePhone } from '@/lib/utils'
import { audit } from '@/lib/audit'

export const POST = route({
  auth: 'public',
  schema: loginSchema,
  rateLimit: 'login',
  skipCsrf: true,
  async handler({ body, request }) {
    const identifier = body.identifier.trim()
    const asPhone = normalizePhone(identifier)

    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(asPhone.length === 8 ? [{ phone: asPhone }] : []),
          ...(identifier.includes('@') ? [{ email: identifier.toLowerCase() }] : []),
        ],
      },
      include: { role: true },
    })

    // Constant-ish work whether or not the account exists.
    if (!user) {
      await dummyPasswordCompare(body.password)
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Phone/email or password is incorrect')
    }

    const valid = await verifyPassword(body.password, user.passwordHash)
    if (!valid) {
      await audit({
        action: 'auth.login_failed',
        entity: 'User',
        entityId: user.id,
        summary: 'Failed login attempt',
        request,
      })
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Phone/email or password is incorrect')
    }

    if (user.status !== 'ACTIVE') {
      throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account is disabled')
    }

    await startSession(user.id)
    if (!user.isStaff) await mergeGuestCart(user.id)

    await audit({
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      summary: `${user.fullName} signed in`,
      request,
    })

    return ok({
      user: {
        id: user.id,
        fullName: user.fullName,
        isStaff: user.isStaff,
        roleKey: user.role?.key ?? null,
        locale: user.locale,
      },
    })
  },
})
