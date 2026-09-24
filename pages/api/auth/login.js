import { query } from '../../../lib/db.cjs'
import { verifyPassword, dummyVerify } from '../../../lib/password.cjs'
import { createSession, setSessionCookie, parseBody } from '../../../lib/session.cjs'

// Logowanie KODEM (jak v1) LUB HASŁEM.
// 1) Najpierw szukamy kodu (pole login, case-insensitive) wśród AKTYWNYCH NIE-adminów.
//    Trafienie = logowanie (tak działa v1 na produkcji).
// 2) Brak kodu = próba hasłem: szukamy użytkownika, którego hash pasuje.
//    Hasła muszą być unikalne (duplikat = odmowa).
// Admin ZAWSZE loguje się hasłem (kod admina nie loguje).

// Prosty limit prób: max 10 na minutę z jednego IP (pamięć procesu)
const hits = new Map()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString()
  const now = Date.now()
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000)
  arr.push(now)
  hits.set(ip, arr)
  if (arr.length > 10) return res.status(429).json({ error: 'Za dużo prób. Odczekaj minutę.' })

  const { password } = await parseBody(req)
  const input = String(password || '').trim()
  if (!input) { await dummyVerify(); return res.status(401).json({ error: 'Nieprawidłowe hasło.' }) }

  // KROK 1: kod radnego (nie admina)
  const byCode = await query(
    'SELECT * FROM users WHERE is_active=true AND is_admin=false AND LOWER(login)=LOWER($1)',
    [input]
  )
  let u = byCode.rows[0] || null

  // KROK 2: hasło (wszyscy, w tym admin) — pełny skan bez early-exit
  if (!u) {
    const r = await query('SELECT * FROM users WHERE is_active=true')
    const matches = []
    for (const cand of r.rows) {
      if (await verifyPassword(input, cand.password_hash)) matches.push(cand)
    }
    if (matches.length !== 1) {
      // 0 = złe hasło; >1 = duplikat haseł — obie sytuacje ten sam komunikat
      return res.status(401).json({ error: 'Nieprawidłowe hasło.' })
    }
    u = matches[0]
  }

  setSessionCookie(res, createSession(u))
  res.json({ ok: true, must_change_password: !!u.must_change_password, is_admin: !!u.is_admin, name: u.name })
}
