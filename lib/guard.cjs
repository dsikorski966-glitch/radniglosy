const { query } = require('./db.cjs')
const { readSession } = require('./session.cjs')

async function getSessionUser(req) {
  const s = readSession(req)
  if (!s) return null
  const r = await query('SELECT id, name, login, is_admin, is_active, must_change_password, avatar_url, title FROM users WHERE id=$1', [s.uid])
  const u = r.rows[0]
  if (!u || !u.is_active) return null
  return u
}

async function requireUser(req, res) {
  const u = await getSessionUser(req)
  if (!u) { res.status(401).json({ error: 'Niezalogowany.' }); return null }
  return u
}

async function requireAdmin(req, res) {
  const u = await requireUser(req, res)
  if (!u) return null
  if (!u.is_admin) { res.status(403).json({ error: 'Brak uprawnień administratora.' }); return null }
  return u
}

// Czy user może prowadzić głosowania w jednostce (chair lub vice tej jednostki, albo admin).
// Vice = zastępstwo przewodniczącego, więc ma te same uprawnienia do głosowań.
async function canChair(user, unitId) {
  if (!user) return false
  if (user.is_admin) return true
  const r = await query('SELECT 1 FROM memberships WHERE user_id=$1 AND unit_id=$2 AND role IN ($3,$4)', [user.id, unitId, 'chair', 'vice'])
  return r.rowCount > 0
}

// Czy user w ogóle może WEJŚĆ do jednostki (widzieć głosowania i historię):
// admin = wszystko, Ogólne = wszyscy, komisja/dział = tylko jej członkowie
async function canViewUnit(user, unitId) {
  if (!user) return false
  if (user.is_admin) return true
  if (unitId === 'ogolne') return true
  const r = await query('SELECT 1 FROM memberships WHERE user_id=$1 AND unit_id=$2', [user.id, unitId])
  return r.rowCount > 0
}

async function audit(actor, action, details) {
  try {
    await query('INSERT INTO audit_log (actor_id, actor_name, action, details) VALUES ($1,$2,$3,$4)',
      [actor ? actor.id : null, actor ? (actor.name || actor.login || '') : 'system', action, details || ''])
  } catch {}
}

// Jednostki użytkownika: Ogólne (wszyscy) + przypisane
async function myUnits(userId, isAdmin) {
  if (isAdmin) {
    const r = await query('SELECT * FROM units ORDER BY position, name')
    return r.rows.map(u => ({ ...u, my_role: 'chair' }))
  }
  const r = await query(
    `SELECT u.*, m.role AS my_role FROM units u
     LEFT JOIN memberships m ON m.unit_id=u.id AND m.user_id=$1
     WHERE u.id='ogolne' OR m.user_id=$1
     ORDER BY (u.id='ogolne') DESC, u.position, u.name`, [userId])
  return r.rows
}

module.exports = { getSessionUser, requireUser, requireAdmin, canChair, canViewUnit, audit, myUnits }
