import fs from 'fs'
import path from 'path'
import { query } from '../../lib/db.cjs'
import { hashPassword, generateTempPassword } from '../../lib/password.cjs'
import { parseBody } from '../../lib/session.cjs'

// POST /api/setup { token } — jednorazowa inicjalizacja bazy na Vercelu.
// Token = SETUP_TOKEN z Environment Variables. Idempotentne (można odpalić wiele razy).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Użyj POST.' })
  const b = await parseBody(req)
  if (!process.env.SETUP_TOKEN || b.token !== process.env.SETUP_TOKEN)
    return res.status(403).json({ error: 'Zły token. Ustaw SETUP_TOKEN w Vercelu i wyślij go w body.' })

  const schema = fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8')
  await query(schema)
  await query(
    "INSERT INTO units (id, name, type, icon, color, position) VALUES ('ogolne','Ogólne','ogolne','gen','#F2C14E',0) ON CONFLICT (id) DO NOTHING")

  const exists = await query('SELECT id, login FROM users WHERE is_admin ORDER BY created_at LIMIT 1')
  const login = (process.env.ADMIN_LOGIN || 'admin').toLowerCase().replace(/[^a-z0-9._-]/g, '') || 'admin'
  const given = (process.env.ADMIN_PASSWORD || '').trim()
  let admin = null
  if (!exists.rowCount) {
    const password = given || await generateTempPassword()
    await query(
      'INSERT INTO users (name, login, password_hash, is_admin, must_change_password) VALUES ($1,$2,$3,true,$4)',
      ['Administrator', login, await hashPassword(password), !given])
    admin = { login, temp_password: given ? '(ustawione w ADMIN_PASSWORD)' : password }
  } else if (given) {
    // Reset hasła admina — ustaw ADMIN_PASSWORD w Vercelu i odpal /api/setup jeszcze raz.
    await query('UPDATE users SET password_hash=$1, must_change_password=false, login=$2 WHERE id=$3',
      [await hashPassword(given), login, exists.rows[0].id])
    admin = { login, temp_password: '(ustawione w ADMIN_PASSWORD)' }
  } else {
    admin = { login: exists.rows[0].login, temp_password: '(admin już istnieje — ustaw ADMIN_PASSWORD żeby zresetować)' }
  }
  res.json({ ok: true, admin })
}
