import { query } from '../../../lib/db.cjs'
import { requireAdmin, audit } from '../../../lib/guard.cjs'
import { parseBody } from '../../../lib/session.cjs'

// Klik: członek -> przewodniczący -> wiceprzewodniczący -> usunięcie
const ORDER = ['member', 'chair', 'vice']
export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (req.method === 'GET') {
    const r = await query('SELECT user_id, unit_id, role FROM memberships')
    return res.json({ memberships: r.rows })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Zła metoda.' })
  const { user_id, unit_id } = await parseBody(req)
  if (!user_id || !unit_id) return res.status(400).json({ error: 'Brak danych.' })
  const cur = await query('SELECT role FROM memberships WHERE user_id=$1 AND unit_id=$2', [user_id, unit_id])
  if (!cur.rowCount) {
    await query('INSERT INTO memberships (user_id, unit_id, role) VALUES ($1,$2,$3)', [user_id, unit_id, 'member'])
    await audit(admin, 'member_add', `${user_id} -> ${unit_id} (member)`)
    return res.json({ ok: true, now: 'member' })
  }
  const idx = ORDER.indexOf(cur.rows[0].role)
  if (idx >= 0 && idx < ORDER.length - 1) {
    const next = ORDER[idx + 1]
    await query('UPDATE memberships SET role=$1 WHERE user_id=$2 AND unit_id=$3', [next, user_id, unit_id])
    await audit(admin, 'member_role', `${user_id} -> ${unit_id} (${next})`)
    return res.json({ ok: true, now: next })
  }
  await query('DELETE FROM memberships WHERE user_id=$1 AND unit_id=$2', [user_id, unit_id])
  await audit(admin, 'member_remove', `${user_id} x ${unit_id}`)
  return res.json({ ok: true, now: null })
}
