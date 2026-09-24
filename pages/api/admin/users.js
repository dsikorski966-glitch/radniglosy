import { query } from '../../../lib/db.cjs'
import { requireAdmin, audit } from '../../../lib/guard.cjs'
import { hashPassword, generateTempPassword, loginFromName } from '../../../lib/password.cjs'
import { parseBody } from '../../../lib/session.cjs'

function validEmail(v) {
  const s = String(v || '').trim().toLowerCase()
  if (!s) return { ok: true, email: null }
  if (s.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false }
  return { ok: true, email: s }
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res)
  if (!admin) return

  if (req.method === 'GET') {
    const r = await query(
      `SELECT u.id, u.name, u.login, u.email, u.is_admin, u.is_active, u.must_change_password, u.avatar_url, u.title, u.created_at,
        COALESCE(json_agg(json_build_object('unit_id', m.unit_id, 'role', m.role, 'unit_name', un.name)) FILTER (WHERE m.unit_id IS NOT NULL), '[]') AS memberships
       FROM users u LEFT JOIN memberships m ON m.user_id=u.id LEFT JOIN units un ON un.id=m.unit_id GROUP BY u.id ORDER BY u.is_admin DESC, u.name`)
    return res.json({ users: r.rows })
  }

  const b = await parseBody(req)

  if (req.method === 'POST') {
    // Dodaj radnego: WYSTARCZY KOD (imię opcjonalne). Hasło tymczasowe pokazane RAZ.
    const code = String(b.code || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const name = String(b.name || '').trim()
    const t = await query('SELECT login FROM users')
    const taken = new Set(t.rows.map(x => x.login))
    let login = code
    if (!login) {
      if (!name) return res.status(400).json({ error: 'Podaj kod (np. RADNY001) — imię nie jest wymagane.' })
      login = loginFromName(name, taken)
    } else if (taken.has(login)) {
      return res.status(400).json({ error: 'Ten kod jest już zajęty.' })
    }
    const temp = await generateTempPassword()
    const display = name || login
    const avatar = String(b.avatar_url || '')
    const title = String(b.title || '')
    const em = validEmail(b.email)
    if (!em.ok) return res.status(400).json({ error: 'Nieprawidłowy adres e-mail.' })
    let r
    try {
      r = await query(
        'INSERT INTO users (name, login, password_hash, is_admin, must_change_password, avatar_url, title, email) VALUES ($1,$2,$3,false,true,$4,$5,$6) RETURNING id, login',
        [display, login, await hashPassword(temp), avatar, title, em.email])
    } catch (e) {
      if (e && e.code === '23505') return res.status(400).json({ error: 'Ten e-mail jest już przypisany do innego konta.' })
      throw e
    }
    await audit(admin, 'user_add', `${display} (${login})`)
    return res.json({ ok: true, id: r.rows[0].id, login, temp_password: temp })
  }

  if (req.method === 'PATCH') {
    const { id, is_active, set_temp_password, is_admin, name, login, avatar_url, title, email } = b
    if (!id) return res.status(400).json({ error: 'Brak id.' })
    if (email !== undefined) {
      const em = validEmail(email)
      if (!em.ok) return res.status(400).json({ error: 'Nieprawidłowy adres e-mail.' })
      try {
        await query('UPDATE users SET email=$1 WHERE id=$2', [em.email, id])
      } catch (e) {
        if (e && e.code === '23505') return res.status(400).json({ error: 'Ten e-mail jest już przypisany do innego konta.' })
        throw e
      }
      await audit(admin, 'user_email', `user ${id} -> ${em.email || '(wyczyszczono)'}`)
    }
    if (typeof avatar_url === 'string') {
      await query('UPDATE users SET avatar_url=$1 WHERE id=$2', [avatar_url, id])
    }
    if (typeof title === 'string') {
      await query('UPDATE users SET title=$1 WHERE id=$2', [title, id])
    }
    if (typeof name === 'string' && name.trim()) {
      await query('UPDATE users SET name=$1 WHERE id=$2', [name.trim(), id])
      await audit(admin, 'user_rename', `user ${id} -> ${name.trim()}`)
    }
    if (typeof login === 'string' && login.trim()) {
      const code = login.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
      if (!code) return res.status(400).json({ error: 'Nieprawidłowy kod.' })
      const busy = await query('SELECT 1 FROM users WHERE login=$1 AND id<>$2', [code, id])
      if (busy.rowCount) return res.status(400).json({ error: 'Ten kod jest już zajęty.' })
      await query('UPDATE users SET login=$1 WHERE id=$2', [code, id])
      await audit(admin, 'user_recode', `user ${id} -> ${code}`)
    }
    if (typeof is_active === 'boolean') {
      await query('UPDATE users SET is_active=$1 WHERE id=$2', [is_active, id])
      await audit(admin, is_active ? 'user_activate' : 'user_deactivate', `user ${id}`)
    }
    if (typeof is_admin === 'boolean') {
      await query('UPDATE users SET is_admin=$1 WHERE id=$2', [is_admin, id])
      await audit(admin, 'user_admin', `user ${id} admin=${is_admin}`)
    }
    if (set_temp_password) {
      const temp = await generateTempPassword()
      await query('UPDATE users SET password_hash=$1, must_change_password=true WHERE id=$2', [await hashPassword(temp), id])
      const r = await query('SELECT login, name FROM users WHERE id=$1', [id])
      await audit(admin, 'password_reset', `${r.rows[0]?.name} (${r.rows[0]?.login})`)
      return res.json({ ok: true, temp_password: temp })
    }
    return res.json({ ok: true })
  }

  if (req.method === 'DELETE') {
    const { id } = await parseBody(req)
    const r = await query('SELECT name, login FROM users WHERE id=$1', [id])
    await query('DELETE FROM users WHERE id=$1', [id])
    await audit(admin, 'user_delete', `${r.rows[0]?.name} (${r.rows[0]?.login})`)
    return res.json({ ok: true })
  }

  res.status(405).json({ error: 'Zła metoda.' })
}
