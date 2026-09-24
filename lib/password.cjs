const crypto = require('crypto')
const { promisify } = require('util')
const scrypt = promisify(crypto.scrypt)
const randomBytes = promisify(crypto.randomBytes)

// Hash: scrypt(32B) + salt(16B), format "s1$salt$hash"
async function hashPassword(password) {
  const salt = (await randomBytes(16)).toString('hex')
  const buf = await scrypt(String(password), salt, 32)
  return `s1$${salt}$${buf.toString('hex')}`
}

async function verifyPassword(password, stored) {
  try {
    if (!stored || typeof stored !== 'string') return false
    const parts = stored.split('$')
    if (parts.length !== 3 || parts[0] !== 's1') return false
    const [, salt, hex] = parts
    const buf = await scrypt(String(password), salt, 32)
    const a = Buffer.from(hex, 'hex')
    const b = Buffer.from(buf)
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch { return false }
}

// Dummy verify — zawsze stały czas (ochrona przed enumeracją loginów)
async function dummyVerify() {
  await scrypt('dummy-timing-protection', 'stala-sol-dsm-2026', 32).catch(() => {})
}

const WORDS = ['Sosna','Rzeka','Wiatr','Rynek','Glog','Lipa','Wisla','Orzel','Dab','Lesny','Zamek','Most','Park','Gora','Las','Brzoza','Jezioro','Mlyn','Klos','Sowa']

// Hasło tymczasowe łatwe do podyktowania: Slowo-Slowo-Slowo-0000
async function generateTempPassword() {
  const pick = () => WORDS[crypto.randomInt(0, WORDS.length)]
  const num = String(crypto.randomInt(0, 10000)).padStart(4, '0')
  return `${pick()}-${pick()}-${pick()}-${num}`
}

function validateNewPassword(pw) {
  if (!pw || typeof pw !== 'string') return 'Hasło jest wymagane.'
  if (pw.length < 8) return 'Hasło musi mieć min. 8 znaków.'
  if (pw.length > 128) return 'Hasło jest za długie (max 128).'
  return null
}

// login z imienia i nazwiska: "Anna Nowak" -> "a.nowak", kolizje -> a.nowak2...
function loginFromName(name, takenSet) {
  const norm = (name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/ł/g, 'l').replace(/[^a-z ]/g, ' ').trim().split(/\s+/)
  let base = 'radny'
  if (norm.length >= 2) base = `${norm[0][0]}.${norm[norm.length - 1]}`
  else if (norm.length === 1 && norm[0]) base = norm[0]
  let login = base
  let i = 2
  while (takenSet && takenSet.has(login)) login = `${base}${i++}`
  if (takenSet) takenSet.add(login)
  return login
}

module.exports = { hashPassword, verifyPassword, dummyVerify, generateTempPassword, validateNewPassword, loginFromName }
