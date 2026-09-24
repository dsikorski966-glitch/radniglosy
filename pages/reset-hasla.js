import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function ResetPassword() {
  const router = useRouter()
  const { token } = router.query
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (pw1 !== pw2) return setError('Hasła nie są identyczne.')
    setBusy(true)
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password: pw1 }),
      })
      const data = await r.json()
      if (!r.ok) setError(data.error || 'Coś poszło nie tak.')
      else setDone(true)
    } finally { setBusy(false) }
  }

  return (
    <>
      <Head><title>Nowe hasło — DSM Głosowanie</title></Head>
      <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 20px', fontFamily: 'Arial,sans-serif' }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Ustaw nowe hasło</h1>
        {done ? (
          <p>Hasło zostało zmienione. <a href="/">Zaloguj się</a>.</p>
        ) : (
          <form onSubmit={submit}>
            <input type="password" required minLength={8} value={pw1} onChange={e => setPw1(e.target.value)}
              placeholder="Nowe hasło" style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #ccc', marginBottom: 12 }} />
            <input type="password" required minLength={8} value={pw2} onChange={e => setPw2(e.target.value)}
              placeholder="Powtórz nowe hasło" style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #ccc', marginBottom: 12 }} />
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              Wybierz hasło, którego nie masz gdzie indziej — logowanie w tym systemie
              odbywa się samym hasłem, więc musi być unikalne w całej bazie.
            </p>
            {error && <p style={{ color: '#c00', marginBottom: 12 }}>{error}</p>}
            <button disabled={busy || !token} type="submit"
              style={{ width: '100%', padding: 12, borderRadius: 10, background: '#171B2E', color: '#F2C14E', border: 0, fontWeight: 700 }}>
              {busy ? 'Zapisywanie…' : 'Zapisz nowe hasło'}
            </button>
          </form>
        )}
      </main>
    </>
  )
}
