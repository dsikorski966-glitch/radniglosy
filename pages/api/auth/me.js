import { getSessionUser } from '../../../lib/guard.cjs'
import { myUnits } from '../../../lib/guard.cjs'

export default async function handler(req, res) {
  const u = await getSessionUser(req)
  if (!u) return res.status(401).json({ error: 'Niezalogowany.' })
  const units = await myUnits(u.id, u.is_admin)
  res.json({ user: { id: u.id, name: u.name, login: u.login, is_admin: u.is_admin, must_change_password: u.must_change_password, avatar_url: u.avatar_url || '', title: u.title || '' }, units })
}
