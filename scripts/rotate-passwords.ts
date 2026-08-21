/**
 * Rotates staff account passwords away from the seeded demo value.
 *
 *   npx tsx --conditions=react-server --env-file=.env scripts/rotate-passwords.ts
 *   npx tsx ... scripts/rotate-passwords.ts --customers   # customers too
 *
 * The seed ships every account with the same published password, which is fine
 * on a laptop and unacceptable the moment the app is reachable from the
 * internet. This generates one strong random password per account, writes the
 * bcrypt hash, and prints the plaintext ONCE — it is never stored anywhere.
 *
 * Passwords satisfy `passwordSchema` (>= 8 chars, a letter and a digit) and are
 * drawn from `crypto.randomInt`, not `Math.random`.
 *
 * Re-running `npm run db:seed` does NOT undo this: the seed upserts users and
 * leaves an existing passwordHash alone.
 */
import { randomInt } from 'node:crypto'

import { prisma } from '../src/lib/prisma'
import { hashPassword } from '../src/lib/auth'

// No look-alike characters: someone will read these off a screen.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generatePassword(length = 20): string {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  // Guarantee the letter+digit rule rather than hoping for it.
  if (!/\d/.test(out)) out = `${out.slice(0, -1)}${randomInt(2, 10)}`
  if (!/[a-zA-Z]/.test(out)) out = `${out.slice(0, -1)}k`
  return out
}

async function main() {
  const includeCustomers = process.argv.includes('--customers')

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(includeCustomers ? {} : { isStaff: true }),
    },
    select: { id: true, fullName: true, email: true, phone: true, isStaff: true, role: { select: { key: true } } },
    orderBy: [{ isStaff: 'desc' }, { role: { key: 'asc' } }],
  })

  if (users.length === 0) {
    console.log('No accounts found.')
    return
  }

  const issued: { who: string; login: string; password: string; role: string }[] = []

  for (const user of users) {
    const password = generatePassword()
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    })
    issued.push({
      who: user.fullName,
      login: user.email ?? user.phone,
      password,
      role: user.role?.key ?? (user.isStaff ? 'staff' : 'customer'),
    })
  }

  const width = Math.max(...issued.map((r) => r.login.length))

  console.log('\n🔐  New passwords — shown once, not stored anywhere\n')
  for (const row of issued) {
    console.log(`  ${row.login.padEnd(width)}  ${row.password}   (${row.role})`)
  }
  console.log(`\n  ${issued.length} account(s) rotated.`)
  console.log('  Save these in a password manager now. They cannot be recovered.\n')
}

main()
  .catch((error) => {
    console.error('Rotation failed', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
