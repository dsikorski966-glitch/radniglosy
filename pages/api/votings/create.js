import { query } from '../../../lib/db.cjs'
import { requireUser, canChair, audit } from '../../../lib/guard.cjs'
import { parseBody } from '../../../lib/session.cjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  const u = await requireUser(req, res)
  if (!u) return
  const b = await parseBody(req)
  const unitId = String(b.unit_id || 'ogolne')
  if (!(await canChair(u, unitId))) return res.status(403).json({ error: 'Tylko prowadzący jednostkę może tworzyć głosowanie.' })

  const question = String(b.question || '').trim()
  if (!question) return res.status(400).json({ error: 'Podaj treść pytania.' })
  const votingType = ['classic', 'single_choice', 'multi_choice'].includes(b.voting_type) ? b.voting_type : 'classic'
  const options = Array.isArray(b.options) ? b.options.map(s => String(s).trim()).filter(Boolean) : []
  if (votingType !== 'classic' && options.length < 2) return res.status(400).json({ error: 'Dodaj co najmniej 2 opcje.' })
  const maxVotes = votingType === 'multi_choice' ? Math.max(1, Math.min(50, parseInt(b.max_votes_per_user) || 1)) : 1

  await query('UPDATE votings SET is_active=false, closed_at=now() WHERE unit_id=$1 AND is_active=true', [unitId])

  // Zamrożona lista uprawnionych: Ogólne = wszyscy aktywni nie-admini; komisja = członkowie
  let eligible = []
  if (unitId === 'ogolne') {
    const r = await query("SELECT id FROM users WHERE is_active=true AND is_admin=false")
    eligible = r.rows.map(x => x.id)
  } else {
    const r = await query('SELECT user_id FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.unit_id=$1 AND u.is_active=true AND u.is_admin=false', [unitId])
    eligible = r.rows.map(x => x.user_id)
  }

  const r = await query(
    `INSERT INTO votings (unit_id, question, is_secret, voting_type, options, max_votes_per_user, eligible_user_ids, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [unitId, question, b.is_secret !== false, votingType, JSON.stringify(votingType === 'classic' ? [] : options), maxVotes, JSON.stringify(eligible), u.id])
  await audit(u, 'voting_open', `${unitId}: ${question.slice(0, 120)} (uprawnionych: ${eligible.length})`)
  res.json({ ok: true, id: r.rows[0].id })
}
