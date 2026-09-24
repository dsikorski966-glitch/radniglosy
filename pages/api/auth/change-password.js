import { query } from '../../../lib/db.cjs'
import { requireUser, audit } from '../../../lib/guard.cjs'
import { hashPassword, verifyPassword, validateNewPassword } from '../../../lib/password.cjs'
import { parseBody } from '../../../lib/session.cjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  const u = await requireUser(req, res)
  if (!u) return
  const { currentPassword, newPassword } = await parseBody(req)
  const err = validateNewPassword(newPassword)
  if (err) return res.status(400).json({ error: err })
  const r = await query('SELECT password_hash FROM users WHERE id=$1', [u.id])
  const ok = await verifyPassword(String(currentPassword || ''), r.rows[0].password_hash)
  if (!ok) return res.status(400).json({ error: 'Bieżące hasło jest nieprawidłowe.' })
  await query('UPDATE users SET password_hash=$1, must_change_password=false WHERE id=$2', [await hashPassword(String(newPassword)), u.id])
  await audit(u, 'change_password', `Użytkownik ${u.login} zmienił hasło`)
  res.json({ ok: true })
}
