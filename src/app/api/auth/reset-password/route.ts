import { prisma } from '@/lib/prisma'
import { ApiError, ok, route } from '@/lib/api'
import { hashPassword, hashResetToken } from '@/lib/auth'
import { resetPasswordSchema } from '@/lib/validation'
import { audit } from '@/lib/audit'

export const POST = route({
  auth: 'public',
  schema: resetPasswordSchema,
  rateLimit: 'passwordReset',
  skipCsrf: true,
  async handler({ body, request }) {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(body.token) },
      include: { user: { select: { id: true, status: true, deletedAt: true } } },
    })

    if (
      !record ||
      record.usedAt ||
      record.expiresAt < new Date() ||
      record.user.deletedAt ||
      record.user.status !== 'ACTIVE'
    ) {
      throw new ApiError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired')
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(body.password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Any other outstanding token for this user is burned too.
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ])

    await audit({
      action: 'auth.password_reset',
      entity: 'User',
      entityId: record.userId,
      summary: 'Password reset via token',
      request,
    })

    return ok({ reset: true })
  },
})
