const { Pool } = require('pg')

let pool = null
let pglite = null
let pgliteReady = null

// Lokalny tryb plikowy: DATABASE_URL=file:./data/dsm-dev (bez Dockera, baza w folderze projektu)
// Serwer / produkcja: zwykły postgres://... (bez zmian)
function isFileDB() {
  const cs = (process.env.DATABASE_URL || process.env.POSTGRES_URL || '').trim()
  return cs.startsWith('file:') || cs.startsWith('pglite:') || cs === ':memory:'
}

function getDataDir() {
  const cs = (process.env.DATABASE_URL || '').trim()
  if (cs.startsWith('file:')) return cs.slice(5).trim() || './data/dsm-dev'
  if (cs.startsWith('pglite:')) return cs.slice(7).trim() || './data/dsm-dev'
  return './data/dsm-dev'
}

async function getPGlite() {
  if (pglite) {
    await pgliteReady
    return pglite
  }
  const { PGlite } = require('@electric-sql/pglite')
  const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto')
  const dataDir = getDataDir()
  pglite = new PGlite(dataDir === ':memory:' ? undefined : dataDir, {
    extensions: { pgcrypto },
  })
  pgliteReady = pglite.waitReady.then(() => pglite)
    .then(async (db) => {
      // pgcrypto musi być zarejestrowane przed schematem (gen_random_uuid)
      try { await db.exec('CREATE EXTENSION IF NOT EXISTS pgcrypto;') } catch {}
      return db
    })
  return pgliteReady
}

function getPool() {
  if (pool) return pool
  // Na Vercelu ustaw DATABASE_URL (Vercel Postgres / Neon pooler) albo POSTGRES_URL.
  // Lokalnie w Dockerze to postgres://dsm:...@db:5432/dsm
  const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!cs) throw new Error('Brak DATABASE_URL (ustaw w Vercel → Settings → Environment Variables)')
  const needsSSL = /neon\.tech|supabase\.co|sslmode=require/.test(cs)
  const { Pool } = require('pg')
  pool = new Pool({
    connectionString: cs,
    max: process.env.VERCEL ? 2 : 10,
    idleTimeoutMillis: 10000,
    ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {})
  })
  return pool
}

async function query(text, params) {
  if (isFileDB()) {
    const db = await getPGlite()
    const res = await db.query(text, params || [])
    // ujednolicenie z pg: pg daje rowCount, PGlite daje affectedRows/rows
    if (res.rowCount == null) {
      res.rowCount = res.affectedRows != null ? res.affectedRows : (res.rows ? res.rows.length : 0)
    }
    return res
  }
  return getPool().query(text, params)
}

module.exports = { getPool, query, isFileDB }
