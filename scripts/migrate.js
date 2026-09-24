/* Migracja startowa: tworzy tabele, Ogólne, konto admina, opcjonalnie demo.
   Dwa tryby (ten sam plik działa wszędzie):
   - DATABASE_URL=file:./data/dsm-dev  -> lokalna baza W PLIKU, bez Dockera (PGlite)
   - DATABASE_URL=postgres://...        -> normalny Postgres (Docker / serwer / Neon)
*/
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const { hashPassword, generateTempPassword, loginFromName } = require('../lib/password.cjs')

const sleep = ms => new Promise(r => setTimeout(r, ms))

function isFileDB() {
  const cs = (process.env.DATABASE_URL || '').trim()
  return cs.startsWith('file:') || cs.startsWith('pglite:') || cs === ':memory:'
}

function resolveDataDir() {
  const cs = (process.env.DATABASE_URL || '').trim()
  let dir = './data/dsm-dev'
  if (cs.startsWith('file:')) dir = cs.slice(5).trim() || dir
  else if (cs.startsWith('pglite:')) dir = cs.slice(7).trim() || dir
  if (dir === ':memory:') return dir
  // ścieżka względna -> względem katalogu projektu (rodzic scripts/)
  if (!path.isAbsolute(dir)) dir = path.join(__dirname, '..', dir)
  return dir
}

async function connect() {
  if (isFileDB()) {
    const dir = resolveDataDir()
    if (dir !== ':memory:') fs.mkdirSync(dir, { recursive: true })
    const { PGlite } = require('@electric-sql/pglite')
    const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto')
    const db = new PGlite(dir === ':memory:' ? undefined : dir, { extensions: { pgcrypto } })
    await db.waitReady
    try { await db.exec('CREATE EXTENSION IF NOT EXISTS pgcrypto;') } catch {}
    console.log(`[migrate] baza plikowa: ${dir === ':memory:' ? '(pamięć)' : dir}`)
    const wrap = async (text, params) => {
      const r = await db.query(text, params || [])
      if (r.rowCount == null) r.rowCount = r.affectedRows != null ? r.affectedRows : (r.rows ? r.rows.length : 0)
      return r
    }
    return {
      query: wrap,
      exec: (sql) => db.exec(sql),
      end: () => db.close(),
    }
  }
  for (let i = 1; i <= 30; i++) {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    try { await client.connect(); return client } catch (e) {
      console.log(`[migrate] czekam na bazę (${i}/30): ${e.message}`)
      await client.end().catch(() => {})
      await sleep(2000)
    }
  }
  throw new Error('Brak połączenia z bazą')
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Brak DATABASE_URL')
  const db = await connect()
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
  if (db.exec) await db.exec(schema)
  else await db.query(schema)
  console.log('[migrate] schemat OK')

  await db.query(
    "INSERT INTO units (id, name, type, icon, color, position) VALUES ('ogolne','Ogólne','ogolne','gen','#F2C14E',0) ON CONFLICT (id) DO NOTHING")

  const adminLogin = (process.env.ADMIN_LOGIN || 'admin').toLowerCase()
  const exists = await db.query('SELECT 1 FROM users WHERE is_admin LIMIT 1')
  if (!exists.rowCount) {
    const given = process.env.ADMIN_PASSWORD
    const password = given || await generateTempPassword()
    await db.query(
      'INSERT INTO users (name, login, password_hash, is_admin, must_change_password) VALUES ($1,$2,$3,true,$4)',
      ['Administrator', adminLogin, await hashPassword(password), !given])
    console.log('[migrate] =====================================================')
    console.log(`[migrate] Admin login: ${adminLogin}`)
    if (!given) console.log(`[migrate] Hasło tymczasowe: ${password}`)
    else console.log('[migrate] Hasło: z ADMIN_PASSWORD')
    console.log('[migrate] =====================================================')
  }

  if (process.env.SEED_DEMO === 'true') {
    const has = await db.query('SELECT 1 FROM users WHERE NOT is_admin LIMIT 1')
    if (!has.rowCount) await seedDemo(db)
  }
  await db.end()
}

async function seedDemo(db) {
  const units = [
    ['ekologia', 'Ekologia', 'komisja', 'eco', '#8BD15A', 1],
    ['transport', 'Transport', 'komisja', 'trans', '#5B8DEF', 2],
    ['edukacja', 'Edukacja', 'komisja', 'edu', '#3CC9C0', 3],
    ['statutowa', 'Statutowa', 'komisja', 'stat', '#A78BFA', 4],
    ['promocja', 'Promocja', 'dzial', 'promo', '#F06BA0', 5],
  ]
  for (const u of units)
    await db.query('INSERT INTO units (id, name, type, icon, color, position) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', u)
  const people = [
    ['Anna Nowak', { ekologia: 'chair', transport: 'member', promocja: 'member' }],
    ['Piotr Wiśniewski', { ekologia: 'member', edukacja: 'member' }],
    ['Katarzyna Dąbrowska', { ekologia: 'member', statutowa: 'chair' }],
    ['Tomasz Lewandowski', { ekologia: 'member', transport: 'chair', promocja: 'member' }],
    ['Małgorzata Zielińska', { ekologia: 'member', edukacja: 'chair' }],
    ['Krzysztof Szymański', { ogolne: 'chair', ekologia: 'member', statutowa: 'member' }],
    ['Joanna Woźniak', { ekologia: 'member', promocja: 'chair' }],
    ['Jakub Kaczmarek', { statutowa: 'member', transport: 'member', edukacja: 'member' }],
  ]
  // Logowanie jest samym hasłem, więc KAŻDE konto musi mieć inne hasło.
  // Demo: <prefiks>-<Imię>-2026, np. Demo-Anna-2026 (prefiks zmienisz w DEMO_PASSWORD).
  const prefix = process.env.DEMO_PASSWORD || 'Demo'
  const ascii = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0142/g, 'l').replace(/\u0141/g, 'L')
  const taken = new Set(['admin'])
  console.log('[migrate] DEMO: dodano 8 radnych. Hasła do logowania:')
  for (const [name, ms] of people) {
    const login = loginFromName(name, taken)
    const pw = `${prefix}-${ascii(name.split(' ')[0])}-2026`
    const r = await db.query('INSERT INTO users (name, login, password_hash, must_change_password) VALUES ($1,$2,$3,false) RETURNING id', [name, login, await hashPassword(pw)])
    for (const [unit, role] of Object.entries(ms))
      await db.query('INSERT INTO memberships (user_id, unit_id, role) VALUES ($1,$2,$3)', [r.rows[0].id, unit, role])
    console.log(`[migrate]   ${name.padEnd(22)} ${pw}`)
  }
}

main().catch(e => { console.error('[migrate] BŁĄD:', e.message); process.exit(1) })
