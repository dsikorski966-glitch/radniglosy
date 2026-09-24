import { useState } from 'react'
import Head from 'next/head'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }),
      })
    } finally {
      setBusy(false)
      setSent(true) // zawsze pokazujemy ten sam ekran, niezależnie od wyniku
    }
  }

  return (
    <>
      <Head><title>Nie pamiętam hasła — DSM Głosowanie</title></Head>
      <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 20px', fontFamily: 'Arial,sans-serif' }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>Nie pamiętam hasła</h1>
        {sent ? (
          <p>Jeśli ten adres jest w naszej bazie, wysłaliśmy na niego link do resetu hasła. Sprawdź skrzynkę (także folder spam).</p>
        ) : (
          <form onSubmit={submit}>
            <p style={{ color: '#555', marginBottom: 16 }}>Podaj adres e-mail przypisany do Twojego konta.</p>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="np. anna.nowak@example.com"
              style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid #ccc', marginBottom: 16 }} />
            <button disabled={busy} type="submit"
              style={{ width: '100%', padding: 12, borderRadius: 10, background: '#171B2E', color: '#F2C14E', border: 0, fontWeight: 700 }}>
              {busy ? 'Wysyłanie…' : 'Wyślij link resetujący'}
            </button>
          </form>
        )}
        <p style={{ marginTop: 20 }}><a href="/">← Wróć do logowania</a></p>
        <p style={{ marginTop: 8, color: '#888', fontSize: 13 }}>
          Nie masz przypisanego e-maila do konta? Poproś administratora o nowe hasło tymczasowe.
        </p>
      </main>
    </>
  )
}
