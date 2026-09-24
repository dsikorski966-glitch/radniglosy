import { query } from '../../../lib/db.cjs'
import { requireUser, canChair, audit } from '../../../lib/guard.cjs'
import { parseBody } from '../../../lib/session.cjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  const u = await requireUser(req, res)
  if (!u) return
  const { voting_id } = await parseBody(req)
  const v = await query('SELECT * FROM votings WHERE id=$1', [voting_id])
  const voting = v.rows[0]
  if (!voting) return res.status(404).json({ error: 'Nie znaleziono głosowania.' })
  if (!(await canChair(u, voting.unit_id))) return res.status(403).json({ error: 'Brak uprawnień.' })
  await query('UPDATE votings SET is_active=false, closed_at=now() WHERE id=$1', [voting.id])
  await audit(u, 'voting_close', `${voting.unit_id}: ${String(voting.question).slice(0, 120)}`)
  res.json({ ok: true })
}
