import { query } from '../../../lib/db.cjs'
import { requireUser, canChair, canViewUnit } from '../../../lib/guard.cjs'

// Historia jednostki (jawne wyniki + frekwencja; tajne: tylko agregat dla prowadzącego)
export default async function handler(req, res) {
  const u = await requireUser(req, res)
  if (!u) return
  const unitId = String(req.query.unit_id || 'ogolne')
  if (!(await canViewUnit(u, unitId))) return res.status(403).json({ error: 'Brak dostępu do tej komisji.' })
  const r = await query('SELECT * FROM votings WHERE unit_id=$1 AND is_active=false ORDER BY created_at DESC LIMIT 50', [unitId])
  const chair = await canChair(u, unitId)
  const out = []
  for (const v of r.rows) {
    const cnt = await query('SELECT COUNT(*)::int AS n FROM voted_status WHERE voting_id=$1', [v.id])
    let results = null
    if (!v.is_secret) {
      const votes = await query('SELECT v.choice, v.choices, u.name FROM votes v LEFT JOIN users u ON u.id=v.user_id WHERE v.voting_id=$1', [v.id])
      results = votes.rows
    } else if (chair) {
      const c = await query(
        `SELECT COALESCE(v.choice, c.choice) AS label, COUNT(*)::int AS n FROM votes v
         LEFT JOIN LATERAL (SELECT jsonb_array_elements_text(v.choices) AS choice) c ON v.choices IS NOT NULL
         WHERE v.voting_id=$1 GROUP BY 1`, [v.id]).catch(() => ({ rows: [] }))
      results = { counts: c.rows, secret: true }
    }
    out.push({
      id: v.id, unit_id: v.unit_id, question: v.question, is_secret: v.is_secret, voting_type: v.voting_type,
      options: v.options, created_at: v.created_at, closed_at: v.closed_at,
      eligible_count: Array.isArray(v.eligible_user_ids) ? v.eligible_user_ids.length : 0,
      voted_count: cnt.rows[0].n, results
    })
  }
  res.json({ votings: out, i_chair: chair })
}
