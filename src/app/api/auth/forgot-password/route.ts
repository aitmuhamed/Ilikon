import { prisma } from '@/lib/prisma'
import { ok, route } from '@/lib/api'
import { generateResetToken } from '@/lib/auth'
import { forgotPasswordSchema } from '@/lib/validation'
import { normalizePhone } from '@/lib/utils'
import { audit } from '@/lib/audit'
import { isProduction } from '@/lib/env'

export const POST = route({
  auth: 'public',
  schema: forgotPasswordSchema,
  rateLimit: 'passwordReset',
  skipCsrf: true,
  async handler({ body, request }) {
    const identifier = body.identifier.trim()
    const asPhone = normalizePhone(identifier)

    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          ...(asPhone.length === 8 ? [{ phone: asPhone }] : []),
          ...(identifier.includes('@') ? [{ email: identifier.toLowerCase() }] : []),
        ],
      },
      select: { id: true },
    })

    // Always the same response shape: the endpoint must not reveal whether an
    // account exists.
    if (!user) return ok({ sent: true })

    const { token, tokenHash } = generateResetToken()
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    })

    await audit({
      action: 'auth.password_reset_requested',
      entity: 'User',
      entityId: user.id,
      request,
    })

    // Delivery (SMS/email) is a deployment concern; the token is returned only
    // outside production so the flow is testable locally.
    if (!isProduction()) {
      console.info(`[auth] password reset token for ${identifier}: ${token}`)
      return ok({ sent: true, devToken: token })
    }

    return ok({ sent: true })
  },
})
