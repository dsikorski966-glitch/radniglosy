import { query } from '../../../lib/db.cjs'
import { requireUser, canChair, canViewUnit } from '../../../lib/guard.cjs'
import { parseBody } from '../../../lib/session.cjs'

// GET /api/votings/current?unit_id=xxx — aktywne głosowanie jednostki
export default async function handler(req, res) {
  const u = await requireUser(req, res)
  if (!u) return
  const unitId = String(req.query.unit_id || 'ogolne')
  if (!(await canViewUnit(u, unitId))) return res.status(403).json({ error: 'Brak dostępu do tej komisji.' })
  const v = await query('SELECT * FROM votings WHERE unit_id=$1 AND is_active=true ORDER BY created_at DESC LIMIT 1', [unitId])
  const voting = v.rows[0] || null
  if (!voting) return res.json({ voting: null, i_chair: await canChair(u, unitId) })

  const eligible = Array.isArray(voting.eligible_user_ids) ? voting.eligible_user_ids : []
  const isEligible = u.is_admin ? true : eligible.includes(u.id)
  const st = await query('SELECT 1 FROM voted_status WHERE voting_id=$1 AND user_id=$2', [voting.id, u.id])
  const hasVoted = st.rowCount > 0
  const chair = await canChair(u, unitId)

  // Wyniki: jawne dla wszystkich uprawnionych, tajne tylko dla prowadzącego (agregat)
  let results = null
  let myVote = null
  if (!voting.is_secret && (isEligible || chair)) {
    const votes = await query(
      `SELECT v.choice, v.choices, u.name FROM votes v LEFT JOIN users u ON u.id=v.user_id WHERE v.voting_id=$1`, [voting.id])
    results = votes.rows
    if (hasVoted) {
      const mine = await query('SELECT choice, choices FROM votes WHERE voting_id=$1 AND user_id=$2', [voting.id, u.id])
      myVote = mine.rows[0] || null
    }
  } else if (voting.is_secret && chair) {
    const c = await query(
      `SELECT COALESCE(v.choice, c.choice) AS label, COUNT(*)::int AS n FROM votes v
       LEFT JOIN LATERAL (SELECT jsonb_array_elements_text(v.choices) AS choice) c ON v.choices IS NOT NULL
       WHERE v.voting_id=$1 GROUP BY 1`, [voting.id]).catch(() => ({ rows: [] }))
    results = { counts: c.rows, secret: true }
  }
  const cnt = await query('SELECT COUNT(*)::int AS n FROM voted_status WHERE voting_id=$1', [voting.id])

  res.json({
    voting: {
      id: voting.id, unit_id: voting.unit_id, question: voting.question,
      is_secret: voting.is_secret, voting_type: voting.voting_type,
      options: voting.options, max_votes_per_user: voting.max_votes_per_user,
      created_at: voting.created_at, eligible_count: eligible.length
    },
    is_eligible: isEligible, has_voted: hasVoted, my_vote: myVote,
    i_chair: chair, voted_count: cnt.rows[0].n, results
  })
}
