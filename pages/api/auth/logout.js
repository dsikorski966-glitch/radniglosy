import { clearSessionCookie } from '../../../lib/session.cjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  clearSessionCookie(res)
  res.json({ ok: true })
}
