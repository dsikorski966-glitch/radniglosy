// GET /api/health — sprawdza czy ENV z Vercela są dobrze ustawione (bez sekretów w odpowiedzi)
import { query } from '../../lib/db.cjs'

export default async function handler(req, res) {
  const hasDb = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL)
  const hasSession = !!(process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16)
  const hasSetup = !!process.env.SETUP_TOKEN
  let dbOk = false
  let dbError = null
  if (hasDb) {
    try {
      await query('SELECT 1')
      dbOk = true
    } catch (e) { dbError = e.message }
  }
  res.json({
    ok: hasDb && hasSession && dbOk,
    env: { DATABASE_URL_lub_POSTGRES_URL: hasDb, SESSION_SECRET_16plus: hasSession, SETUP_TOKEN: hasSetup },
    db: dbOk ? 'polaczono' : ('blad: ' + (dbError || 'brak DATABASE_URL')),
    next: 'Ustaw brakujące w Vercel → Settings → Environment Variables → Redeploy.'
  })
}
