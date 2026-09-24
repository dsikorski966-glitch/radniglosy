import { query } from '../../../lib/db.cjs'
import { requireAdmin } from '../../../lib/guard.cjs'

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return
  const r = await query('SELECT * FROM audit_log ORDER BY at DESC LIMIT 200')
  res.json({ log: r.rows })
}
