import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    if (!password) return
    setLoading(true); setError('')
    const resp = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    const j = await resp.json().catch(() => ({}))
    if (!resp.ok) { setError(j.error || 'Błąd logowania.'); setLoading(false); return }
    router.push(j.is_admin ? '/admin' : '/glosowanie')
  }

  return (
    <>
      <Head><title>Logowanie – Dolnośląski Sejmik Młodzieży</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center scale-110" style={{ backgroundImage: 'url(/panelfacebook.png)', filter: 'blur(8px)' }} />
        <div className="absolute inset-0 bg-black/40" />
        <div className="w-full max-w-sm relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-3xl mb-4 border border-white/30 backdrop-blur-sm p-2">
              <img src="https://mlodziezowysejmik.pl/wp-content/uploads/2026/06/logoDSM.png" alt="DSM" className="w-full h-full object-contain" onError={e => { e.target.src = '/icons/system-glosowania.jpg' }} />
            </div>
            <h1 className="text-2xl font-bold text-white">Dolnośląski Sejmik Młodzieży</h1>
          </div>
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Zaloguj się</h2>
            <p className="text-slate-500 text-sm mb-6">Wpisz hasło otrzymane od administratora</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Hasło" autoFocus autoComplete="current-password"
                className="w-full px-4 py-4 text-xl text-center border-2 border-slate-200 rounded-xl focus:border-brand-500 focus:outline-none" />
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">⚠️ {error}</div>}
              <button type="submit" disabled={loading || !password} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-black font-bold text-lg py-4 rounded-xl transition-colors shadow-md">
                {loading ? 'Logowanie...' : 'Zaloguj się →'}
              </button>
            </form>
            <p className="text-center text-sm mt-4"><a href="/zapomniane-hasla" className="text-brand-700 underline">Nie pamiętam hasła</a></p>
            <p className="text-center text-xs text-slate-400 mt-4">Bezpieczne połączenie</p>
          </div>
        </div>
      </div>
    </>
  )
}
