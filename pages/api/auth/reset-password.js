import { query } from '../../../lib/db.cjs'
import { parseBody } from '../../../lib/session.cjs'
import { hashPassword, validateNewPassword } from '../../../lib/password.cjs'
import { peekResetToken, consumeResetToken } from '../../../lib/reset-tokens.cjs'
import { audit } from '../../../lib/guard.cjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  const { token, password } = await parseBody(req)

  const userId = await peekResetToken(token)
  if (!userId) return res.status(400).json({ error: 'Link jest nieprawidłowy albo wygasł. Poproś o nowy.' })

  const err = validateNewPassword(password)
  if (err) return res.status(400).json({ error: err })

  const hash = await hashPassword(password)
  await query('UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2', [hash, userId])
  await consumeResetToken(token)
  const u = await query('SELECT name, login FROM users WHERE id = $1', [userId])
  await audit({ id: userId, name: u.rows[0]?.name || u.rows[0]?.login }, 'password_reset_email', 'Nowe hasło przez link resetu')

  res.json({ ok: true })
}
