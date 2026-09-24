const crypto = require('crypto')

const COOKIE = 'dsm_session'
const MAX_AGE = 60 * 60 * 12 // 12h

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw new Error('Ustaw SESSION_SECRET (min 16 znaków) w .env')
  return s
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', secret()).update(payloadB64).digest('base64url')
}

function createSession(user) {
  const payload = Buffer.from(JSON.stringify({
    uid: user.id, admin: !!user.is_admin, exp: Date.now() + MAX_AGE * 1000
  })).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function readSession(req) {
  try {
    const header = req.headers.cookie || ''
    const m = header.split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='))
    if (!m) return null
    const token = decodeURIComponent(m.slice(COOKIE.length + 1))
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null
    const expect = sign(payload)
    const a = Buffer.from(sig), b = Buffer.from(expect)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data.uid || Date.now() > data.exp) return null
    return data
  } catch { return null }
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`)
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`)
}

function parseBody(req) {
  return new Promise(resolve => {
    if (req.body !== undefined) {
      if (typeof req.body === 'string') { try { resolve(JSON.parse(req.body)) } catch { resolve({}) } return }
      resolve(req.body || {})
      return
    }
    let raw = ''
    req.on('data', c => raw += c)
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch { resolve({}) } })
  })
}

module.exports = { createSession, readSession, setSessionCookie, clearSessionCookie, parseBody, COOKIE }
