import { query } from '../../../lib/db.cjs'
import { requireAdmin, audit } from '../../../lib/guard.cjs'
import { parseBody } from '../../../lib/session.cjs'

const ICONS = ['gen','eco','trans','edu','stat','promo']

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const r = await query('SELECT * FROM units ORDER BY position, name')
    return res.json({ units: r.rows, icons: ICONS })
  }
  const b = await parseBody(req)
  if (req.method === 'POST') {
    const name = String(b.name || '').trim()
    if (!name) return res.status(400).json({ error: 'Podaj nazwę.' })
    const type = b.type === 'dzial' ? 'dzial' : 'komisja'
    const id = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ł/g,'l').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) || ('u' + Date.now())
    const icon = ICONS.includes(b.icon) ? b.icon : 'gen'
    const color = String(b.color || '#5B8DEF')
    const pos = parseInt(b.position) || 0
    await query('INSERT INTO units (id, name, type, icon, color, position) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, type=EXCLUDED.type, icon=EXCLUDED.icon, color=EXCLUDED.color, position=EXCLUDED.position',
      [id, name, type, icon, color, pos])
    await audit(admin, 'unit_upsert', `${name} (${id})`)
    return res.json({ ok: true, id })
  }
  if (req.method === 'DELETE') {
    if (b.id === 'ogolne') return res.status(400).json({ error: 'Nie można usunąć Ogólnych.' })
    await query('DELETE FROM units WHERE id=$1', [b.id])
    await audit(admin, 'unit_delete', String(b.id))
    return res.json({ ok: true })
  }
  res.status(405).json({ error: 'Zła metoda.' })
}
