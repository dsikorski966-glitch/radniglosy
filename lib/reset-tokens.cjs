// lib/reset-tokens.cjs
const crypto = require('crypto')
const { query } = require('./db.cjs')

const TTL_MS = 30 * 60 * 1000 // 30 minut

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Zwraca surowy token (do wysłania mailem). W bazie zapisujemy tylko jego hash.
async function createResetToken(userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TTL_MS)
  await query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2,$3)', [userId, tokenHash, expiresAt])
  return token
}

// Zwraca user_id jeśli token jest ważny i nieużyty, inaczej null. Nie zużywa tokenu.
async function peekResetToken(token) {
  if (!token || typeof token !== 'string') return null
  const r = await query(
    'SELECT user_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()',
    [hashToken(token)])
  return r.rows[0] ? r.rows[0].user_id : null
}

// Oznacza token jako zużyty. Wywołuj DOPIERO po udanej zmianie hasła.
async function consumeResetToken(token) {
  await query('UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL', [hashToken(token)])
}

module.exports = { createResetToken, peekResetToken, consumeResetToken, TTL_MS }
