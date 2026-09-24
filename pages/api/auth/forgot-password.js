import { query } from '../../../lib/db.cjs'
import { parseBody } from '../../../lib/session.cjs'
import { createResetToken } from '../../../lib/reset-tokens.cjs'
import { sendPasswordResetEmail } from '../../../lib/email.cjs'

// Limit prób: max 5 na minutę z jednego IP, max 3 na 15 minut na dany adres e-mail.
const hitsIp = new Map()
const hitsEmail = new Map()
function tooMany(map, key, max, windowMs) {
  const now = Date.now()
  const arr = (map.get(key) || []).filter(t => now - t < windowMs)
  arr.push(now)
  map.set(key, arr)
  return arr.length > max
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString()
  const { email } = await parseBody(req)
  const clean = String(email || '').trim().toLowerCase()

  const GENERIC = { ok: true, message: 'Jeśli ten adres jest w naszej bazie, wysłaliśmy na niego link do resetu hasła.' }

  if (!clean || !clean.includes('@') || clean.length > 200) return res.json(GENERIC)
  if (tooMany(hitsIp, ip, 5, 60_000)) return res.json(GENERIC)
  if (tooMany(hitsEmail, clean, 3, 15 * 60_000)) return res.json(GENERIC)

  try {
    const r = await query('SELECT id, name, email FROM users WHERE lower(email) = $1 AND is_active = true', [clean])
    const user = r.rows[0]
    if (user) {
      const base = String(process.env.APP_URL || '').replace(/\/$/, '')
      if (!base) throw new Error('Brak APP_URL w zmiennych środowiskowych')
      const token = await createResetToken(user.id)
      const url = `${base}/reset-hasla?token=${encodeURIComponent(token)}`
      await sendPasswordResetEmail({ to: user.email, name: user.name, url })
    }
  } catch (e) {
    console.error('forgot-password:', e.message) // log po stronie serwera, ale odpowiedź dla usera bez zmian
  }
  res.json(GENERIC)
}
