import { query } from '../../../lib/db.cjs'
import { requireUser, audit } from '../../../lib/guard.cjs'
import { parseBody } from '../../../lib/session.cjs'

// Głos bierze użytkownika Z SESJI (nie z body) — koniec z podszywaniem się
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  const u = await requireUser(req, res)
  if (!u) return
  const b = await parseBody(req)
  const v = await query('SELECT * FROM votings WHERE id=$1 AND is_active=true', [b.voting_id])
  const voting = v.rows[0]
  if (!voting) return res.status(404).json({ error: 'Głosowanie nieaktywne.' })
  const eligible = Array.isArray(voting.eligible_user_ids) ? voting.eligible_user_ids : []
  if (!u.is_admin && !eligible.includes(u.id)) return res.status(403).json({ error: 'Nie jesteś uprawniony do tego głosowania.' })

  try {
    await query('INSERT INTO voted_status (voting_id, user_id) VALUES ($1,$2)', [voting.id, u.id])
  } catch (e) {
    if (e && e.code === '23505') return res.status(409).json({ error: 'Już oddałeś głos.' })
    throw e
  }

  try {
    if (voting.voting_type === 'multi_choice') {
      const arr = Array.isArray(b.choices) ? b.choices.map(String) : []
      const allowed = new Set(voting.options || [])
      const clean = arr.filter(o => allowed.has(o)).slice(0, voting.max_votes_per_user || 1)
      if (!clean.length) throw new Error('Wybierz co najmniej 1 opcję.')
      await query('INSERT INTO votes (voting_id, user_id, choices) VALUES ($1,$2,$3)',
        [voting.id, voting.is_secret ? null : u.id, JSON.stringify(clean)])
    } else if (voting.voting_type === 'single_choice') {
      const c = String(b.choice || '')
      if (!(voting.options || []).includes(c)) throw new Error('Nieprawidłowa opcja.')
      await query('INSERT INTO votes (voting_id, user_id, choice) VALUES ($1,$2,$3)', [voting.id, voting.is_secret ? null : u.id, c])
    } else {
      const c = String(b.choice || '')
      if (!['ZA', 'PRZECIW', 'WSTRZ'].includes(c)) throw new Error('Nieprawidłowy wybór.')
      await query('INSERT INTO votes (voting_id, user_id, choice) VALUES ($1,$2,$3)', [voting.id, voting.is_secret ? null : u.id, c])
    }
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Błąd zapisu głosu.' })
  }
  res.json({ ok: true, secret: !!voting.is_secret })
}
