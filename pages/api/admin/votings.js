import { query } from '../../../lib/db.cjs'
import { requireAdmin, audit } from '../../../lib/guard.cjs'
import { parseBody } from '../../../lib/session.cjs'

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  if (req.method === 'GET') {
    const r = await query('SELECT v.*, u.name AS unit_name FROM votings v JOIN units u ON u.id=v.unit_id ORDER BY v.created_at DESC LIMIT 100')
    return res.json({ votings: r.rows })
  }
  if (req.method === 'POST') {
    // Awaryjne zamknięcie dowolnego głosowania
    const { voting_id } = await parseBody(req)
    await query('UPDATE votings SET is_active=false, closed_at=now() WHERE id=$1', [voting_id])
    await audit(admin, 'voting_close_admin', String(voting_id))
    return res.json({ ok: true })
  }
  if (req.method === 'DELETE') {
    const { voting_id } = await parseBody(req)
    await query('DELETE FROM votings WHERE id=$1', [voting_id])
    await audit(admin, 'voting_delete', String(voting_id))
    return res.json({ ok: true })
  }
  res.status(405).json({ error: 'Zła metoda.' })
}
