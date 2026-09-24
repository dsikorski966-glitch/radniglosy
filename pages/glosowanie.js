import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import UnitIcon, { colorFor } from '../components/UnitIcon'

const LOGO = 'https://mlodziezowysejmik.pl/wp-content/uploads/2026/06/logoDSM.png'

// ========== HISTORIA KOMISJI (styl oryginału) ==========
function TabHistoria({ unit, hist, official }) {
  if (!hist.length) {
    return (
      <div className="text-center py-12 text-slate-400">
        <div className="text-4xl mb-3">📭</div>
        <p className="font-semibold">Brak zakończonych głosowań</p>
        <p className="text-xs mt-1">w komisji: {unit.name}</p>
      </div>
    )
  }
  const typeLabel = (v) => (v.voting_type === 'classic' || !v.voting_type) ? 'Klasyczne' : v.voting_type === 'single_choice' ? 'Pojedynczy wybór' : 'Wielokrotny wybór'
  return (
    <div className="space-y-3">
      {hist.map(v => (
        <div key={v.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-700 text-slate-300">🟢 Zakończone</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${v.is_secret ? 'bg-purple-500/10 text-purple-300' : 'bg-blue-500/10 text-blue-300'}`}>
              {v.is_secret ? '🔒 Tajne' : 'Jawne'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-700 text-slate-300">{typeLabel(v)}</span>
          </div>
          <p className="text-white font-semibold text-sm leading-snug break-words">{v.question}</p>
          <p className="text-xs mt-1 text-slate-400">
            {v.created_at ? new Date(v.created_at).toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
            {' '}· frekwencja {v.voted_count}/{v.eligible_count}
          </p>
          <div className="mt-3"><Results voting={v} results={v.results} votedCount={v.voted_count} official={official} /></div>
          <button onClick={() => window.print()} className="mt-3 text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg">🖨 Eksport / PDF (drukuj stronę)</button>
        </div>
      ))}
    </div>
  )
}

function Counts({ results, voting }) {
  if (!results) return <p className="text-xs text-slate-500 italic">🔒 Wyniki tajne — widoczne dla prowadzącego komisję.</p>
  if (results.secret) {
    return (
      <div className="space-y-2">
        {(results.counts || []).map((c, i) => (
          <div key={i} className="flex justify-between text-sm bg-slate-700/40 rounded-lg px-3 py-2">
            <span className="text-slate-200 font-semibold">{c.label}</span>
            <span className="text-white font-bold">{c.n}</span>
          </div>
        ))}
        <p className="text-xs text-purple-300">🔒 Głosowanie tajne — tylko liczby, bez nazwisk.</p>
      </div>
    )
  }
  const opts = voting.voting_type === 'classic' ? ['ZA', 'WSTRZ', 'PRZECIW'] : (voting.options || [])
  const countFor = (opt) => results.filter(v => v.choice === opt || (v.choices && v.choices.includes(opt))).length
  const namesFor = (opt) => results.filter(v => v.choice === opt || (v.choices && v.choices.includes(opt))).map(v => v.name || '—')
  return (
    <div className="space-y-3">
      {opts.map(opt => (
        <div key={opt}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-bold text-slate-200">{opt}</span>
            <span className="text-white font-bold">{countFor(opt)}</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500" style={{ width: `${results.length ? Math.round(countFor(opt) / Math.max(1, results.length) * 100) : 0}%` }} />
          </div>
          {!voting.is_secret && <p className="text-xs text-slate-400 mt-1">{namesFor(opt).join(', ') || 'Brak'}</p>}
        </div>
      ))}
    </div>
  )
}

// ========== WYNIKI OFICJALNE (herb + werdykt + statystyki, styl v1) ==========
function OfficialResults({ voting, results, votedCount, children }) {
  const isClassic = voting.voting_type === 'classic' || !voting.voting_type
  const secret = !!voting.is_secret
  const eligible = voting.eligible_count || 0
  const rows = !secret && Array.isArray(results) ? results : []
  const counts = secret && results && results.counts ? results.counts : null
  const zaCount = secret ? (counts?.find(c => c.label === 'ZA')?.n || 0) : rows.filter(v => v.choice === 'ZA').length
  const przeciwCount = secret ? (counts?.find(c => c.label === 'PRZECIW')?.n || 0) : rows.filter(v => v.choice === 'PRZECIW').length
  const wstrzCount = secret ? (counts?.find(c => c.label === 'WSTRZ')?.n || 0) : rows.filter(v => v.choice === 'WSTRZ').length
  const totalClassic = zaCount + przeciwCount + wstrzCount
  const opts = Array.isArray(voting.options) ? voting.options : []
  const optCounts = {}
  opts.forEach(o => { optCounts[o] = 0 })
  if (!isClassic) {
    if (secret && counts) counts.forEach(c => { if (optCounts[c.label] !== undefined) optCounts[c.label] = c.n })
    else rows.forEach(v => {
      if (v.choices && Array.isArray(v.choices)) v.choices.forEach(c => { if (optCounts[c] !== undefined) optCounts[c]++ })
      else if (v.choice && optCounts[v.choice] !== undefined) optCounts[v.choice]++
    })
  }
  const optTotal = Object.values(optCounts).reduce((a, b) => a + b, 0)
  const total = isClassic ? totalClassic : optTotal
  const missing = Math.max(0, eligible - (isClassic ? totalClassic : votedCount))
  const kworum = Math.floor(eligible / 2) + 1
  const werdykt = (() => {
    if (isClassic) {
      if (totalClassic === 0) return 'Brak głosów'
      if (totalClassic < kworum) return 'Odrzucono'
      if (przeciwCount === 0 && wstrzCount === 0 && zaCount >= kworum) return 'Przyjęto jednomyślnie'
      if (zaCount > przeciwCount && zaCount >= kworum) return 'Przyjęto'
      if (zaCount < przeciwCount) return 'Odrzucono'
      return 'Remis'
    }
    if (optTotal === 0) return 'Brak głosów'
    const sorted = Object.entries(optCounts).sort((a, b) => b[1] - a[1])
    return `Wygrywa: ${sorted[0][0]} (${sorted[0][1]})`
  })()
  const stats = [
    { icon: '🔒', val: eligible, lbl: 'Uprawnieni' },
    { icon: '🗳️', val: isClassic ? totalClassic : optTotal, lbl: 'Głosy' },
    { icon: 'K', val: kworum, lbl: 'Kworum' },
  ]
  return (
    <div className="space-y-3">
      <div className="bg-[#1a1e27] border border-[#3a4155] rounded-xl p-4 flex items-center gap-3">
        <img src={LOGO} alt="DSM" className="h-12 object-contain shrink-0" onError={e => { e.target.src = '/icons/system-glosowania.jpg' }} />
        <div className="w-px h-10 bg-[#3a4155] shrink-0" />
        <div className="min-w-0">
          <div className="text-white font-black text-sm tracking-wider leading-tight">DOLNOŚLĄSKI SEJMIK MŁODZIEŻY</div>
          <div className="text-[#b0bac8] font-bold text-[10px] tracking-[0.15em] mt-0.5 uppercase">Sejmik Województwa Dolnośląskiego</div>
        </div>
      </div>
      <div className="bg-[#252b38] border border-[#3a4155] rounded-xl p-4">
        <div className="text-xs font-extrabold tracking-wider text-white mb-1">WYNIKI GŁOSOWANIA <span className="font-normal text-[#8892a4]">({secret ? 'Tajne' : 'Jawne'})</span></div>
        <div className="text-xs text-[#8892a4] mb-3 leading-relaxed break-words">{voting.question}</div>
        <div className="bg-[#2c3344] border border-[#3a4155] rounded-lg p-3 flex flex-col gap-3 mb-3">
          <div className="text-base font-black text-white leading-tight whitespace-pre-line">{werdykt}</div>
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-xs">{s.icon}</span>
                <span className="text-sm font-bold text-white">{s.val}</span>
                <span className="text-[10px] text-[#8892a4]">{s.lbl}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#8892a4]">Brak głosu: {missing} · frekwencja {votedCount}/{eligible}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

// Wrapper: tryb oficjalny albo zwykły
function Results({ voting, results, votedCount, official }) {
  if (official) return <OfficialResults voting={voting} results={results} votedCount={votedCount}><Counts results={results} voting={voting} /></OfficialResults>
  return <Counts results={results} voting={voting} />
}

// ========== POKÓJ KOMISJI (styl oryginału) ==========
function Room({ unit, back, goHist, official }) {
  const [data, setData] = useState(null)
  const [hist, setHist] = useState([])
  const [connected, setConnected] = useState(true)
  const [q, setQ] = useState('')
  const [secret, setSecret] = useState(true)
  const [vtype, setVtype] = useState('classic')
  const [opts, setOpts] = useState(['', ''])
  const [maxV, setMaxV] = useState(1)
  const [sel, setSel] = useState([])
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const r = await fetch(`/api/votings/current?unit_id=${unit.id}&t=${Date.now()}`, { cache: 'no-store' })
      if (r.ok) { setData(await r.json()); setConnected(true) } else setConnected(false)
      const h = await fetch(`/api/votings/history?unit_id=${unit.id}`)
      if (h.ok) setHist((await h.json()).votings || [])
    } catch { setConnected(false) }
  }
  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t) }, [unit.id])

  async function vote(choice, choices) {
    if (busy) return
    setBusy(true)
    const resp = await fetch('/api/votings/vote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voting_id: data.voting.id, choice, choices })
    })
    const j = await resp.json().catch(() => ({}))
    if (!resp.ok) alert(j.error || 'Błąd głosowania')
    else { setSel([]); load() }
    setBusy(false)
  }

  async function create() {
    if (!q.trim()) return
    setBusy(true)
    const resp = await fetch('/api/votings/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unit.id, question: q.trim(), is_secret: secret, voting_type: vtype, options: opts, max_votes_per_user: maxV })
    })
    const j = await resp.json().catch(() => ({}))
    if (!resp.ok) alert(j.error || 'Błąd tworzenia')
    else { setQ(''); setOpts(['', '']); load() }
    setBusy(false)
  }

  async function close() {
    if (!confirm('Zamknąć głosowanie?')) return
    await fetch('/api/votings/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voting_id: data.voting.id }) })
    load()
  }

  const v = data?.voting

  return (
    <div>
      <button onClick={back} className="text-sm text-slate-400 mb-3">← Wróć do wyboru komisji</button>

      {!v ? (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-4">
            <UnitIcon unit={unit} size={72} />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{unit.name}</h3>
          <p className="text-slate-400 text-sm mb-4">{unit.my_role === 'chair' ? '★ prowadzący' : unit.my_role === 'vice' ? '☆ wiceprzewodniczący' : 'członek'}</p>
          <div className="flex justify-center mb-4">
            <span className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border ${connected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${connected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {connected ? 'Połączono na żywo' : 'Ponowne łączenie...'}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Oczekiwanie na głosowanie</h3>
          <p className="text-slate-400 text-sm">Gdy prowadzący uruchomi nowe głosowanie, pojawi się ono automatycznie.</p>
          {hist.length > 0 && (
            <button onClick={goHist} className="mt-4 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-600 bg-white/5 text-slate-300">📜 Historia ({hist.length})</button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-center mb-4">
              <img src={LOGO} alt="DSM" className="h-20 sm:h-24 object-contain" onError={e => { e.target.src = '/icons/system-glosowania.jpg' }} />
            </div>
            <div className="flex items-center justify-center gap-2 mb-4 flex-wrap">
              <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider border ${
                v.is_secret ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}>
                {v.is_secret ? '🔒 Głosowanie Tajne' : 'Głosowanie Jawne'}
              </span>
              <span className="px-3 py-1 text-xs font-bold rounded-full border bg-slate-700 text-slate-300 border-slate-600">{unit.name}</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-white leading-snug break-words text-center">{v.question}</h2>
            <p className="text-xs text-slate-500 mt-2 text-center">Zagłosowało {data.voted_count}/{v.eligible_count}</p>
          </div>

          {!data.is_eligible && <p className="text-sm text-amber-400">Nie jesteś uprawniony do tego głosowania (lista zamrożona w chwili otwarcia).</p>}

          {data.has_voted ? (
            v.is_secret ? (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 text-center space-y-4">
                <h3 className="text-xl font-bold text-amber-100">Głos pomyślnie oddany</h3>
                <p className="text-slate-400 text-sm">Dziękujemy, Twoje stanowisko zostało zarejestrowane.</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 border border-amber-600/50 rounded-lg text-amber-200 text-sm font-semibold bg-slate-700/50">
                  <span>✓</span> Głos oddany
                </div>
                {data.i_chair && <div className="mt-2 text-left"><Results voting={v} results={data.results} votedCount={data.voted_count} official={official} /></div>}
              </div>
            ) : (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5">
                <p className="text-emerald-400 font-bold mb-3">✓ Twój głos został zapisany</p>
                <Results voting={v} results={data.results} votedCount={data.voted_count} official={official} />
              </div>
            )
          ) : data.is_eligible && (
            <div className="flex flex-col gap-3">
              {v.voting_type === 'classic' && (
                <>
                  <button onClick={() => vote('ZA')} disabled={busy} className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-base sm:text-lg py-4 sm:py-5 rounded-xl transition-all shadow-lg border border-emerald-600">{busy ? 'Przetwarzanie...' : '✓ Jestem ZA'}</button>
                  <button onClick={() => vote('WSTRZ')} disabled={busy} className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-base sm:text-lg py-4 sm:py-5 rounded-xl transition-all shadow-lg border border-amber-600">{busy ? 'Przetwarzanie...' : '– Wstrzymuję się'}</button>
                  <button onClick={() => vote('PRZECIW')} disabled={busy} className="w-full bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-bold text-base sm:text-lg py-4 sm:py-5 rounded-xl transition-all shadow-lg border border-rose-600">{busy ? 'Przetwarzanie...' : '✗ Jestem PRZECIW'}</button>
                </>
              )}
              {v.voting_type === 'single_choice' && (v.options || []).map(o => (
                <button key={o} disabled={busy} onClick={() => vote(o)} className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold text-base sm:text-lg py-4 sm:py-5 rounded-xl border border-slate-600">{o}</button>
              ))}
              {v.voting_type === 'multi_choice' && (
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-6 space-y-4">
                  <p className="text-slate-300 text-sm text-center">Wybierz do {v.max_votes_per_user} opcji:</p>
                  <div className="space-y-2">
                    {(v.options || []).map(o => (
                      <label key={o} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer ${sel.includes(o) ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-slate-500'}`}>
                        <input type="checkbox" checked={sel.includes(o)} onChange={() => setSel(s => s.includes(o) ? s.filter(x => x !== o) : [...s, o].slice(0, v.max_votes_per_user))} className="w-5 h-5 accent-emerald-500" />
                        <span className="text-white font-semibold">{o}</span>
                      </label>
                    ))}
                  </div>
                  <button disabled={busy || !sel.length} onClick={() => vote(undefined, sel)} className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl">✓ Zatwierdź ({sel.length}/{v.max_votes_per_user})</button>
                </div>
              )}
            </div>
          )}

          {data.i_chair && v && (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              {!data.has_voted && <Results voting={v} results={data.results} votedCount={data.voted_count} official={official} />}
              <button onClick={close} className={`${!data.has_voted ? 'mt-3' : ''} w-full bg-slate-900 border border-slate-600 text-white font-bold py-3 rounded-xl`}>✕ Zamknij głosowanie</button>
            </div>
          )}

        </div>
      )}
      {data?.i_chair && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mt-4">
          <h3 className="text-white font-bold mb-2">＋ Nowe głosowanie</h3>
          <textarea value={q} onChange={e => setQ(e.target.value)} placeholder="np. Uchwała nr 42…" rows={2} className="w-full px-3 py-2 rounded-xl bg-slate-900 text-white border border-slate-700" />
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[['classic', 'Klasyczne'], ['single_choice', 'Pojedynczy'], ['multi_choice', 'Wielokrotny']].map(([val, lab]) => (
              <button key={val} onClick={() => setVtype(val)} className={`py-2 rounded-xl text-sm font-bold ${vtype === val ? 'bg-brand-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{lab}</button>
            ))}
          </div>
          {vtype !== 'classic' && (
            <div className="mt-2 space-y-2">
              {opts.map((o, i) => (
                <input key={i} value={o} onChange={e => { const n = [...opts]; n[i] = e.target.value; setOpts(n) }} placeholder={`Opcja ${i + 1}`} className="w-full px-3 py-2 rounded-xl bg-slate-900 text-white border border-slate-700" />
              ))}
              <button onClick={() => setOpts([...opts, ''])} className="text-sm text-slate-300">＋ Dodaj opcję</button>
            </div>
          )}
          {vtype === 'multi_choice' && (
            <div className="mt-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Ile opcji może zaznaczyć jedna osoba:</label>
              <input type="number" min={1} max={50} value={maxV} onChange={e => setMaxV(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 text-white border border-slate-700" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => setSecret(true)} className={`py-2 rounded-xl text-sm font-bold ${secret ? 'bg-purple-500 text-white' : 'bg-slate-700 text-slate-300'}`}>🔒 Tajne</button>
            <button onClick={() => setSecret(false)} className={`py-2 rounded-xl text-sm font-bold ${!secret ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Jawne</button>
          </div>
          <button disabled={busy} onClick={create} className="mt-3 w-full bg-orange-500 text-white font-bold py-3 rounded-xl">▶ Uruchom</button>
        </div>
      )}
    </div>
  )
}

// ========== STRONA RADNEGO ==========
export default function GlosowaniePage() {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [units, setUnits] = useState([])
  const [open, setOpen] = useState(null)
  const [view, setView] = useState('live') // 'live' | 'historia' (w otwartej komisji)
  const [hist, setHist] = useState([])
  const [newPw, setNewPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [officialMode, setOfficialMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [saveAnimation, setSaveAnimation] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(async r => {
      if (!r.ok) { router.push('/'); return }
      const j = await r.json()
      if (j.user.is_admin) { router.push('/admin'); return }
      setMe(j.user)
      setUnits(j.units || [])
    })
    try {
      const so = localStorage.getItem('dsm_official_mode')
      if (so !== null) setOfficialMode(JSON.parse(so))
    } catch {}
    const onStorage = (e) => {
      try { if (e.key === 'dsm_official_mode') setOfficialMode(JSON.parse(e.newValue || 'false')) } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    if (!open || view !== 'historia') return
    fetch(`/api/votings/history?unit_id=${open.id}`).then(async r => {
      if (r.ok) setHist((await r.json()).votings || [])
    })
  }, [open, view])

  function pick(u) { setOpen(u); setView('live'); setHist([]) }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  async function changePw() {
    setPwMsg('')
    if (!newPw) return
    const cur = prompt('Podaj bieżące hasło:')
    if (!cur) return
    const r = await fetch('/api/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: cur, newPassword: newPw }) })
    const j = await r.json().catch(() => ({}))
    setPwMsg(r.ok ? '✅ Hasło zmienione.' : ('⚠️ ' + (j.error || 'Błąd')))
    if (r.ok) setNewPw('')
  }

  const bgStyle = {
    backgroundImage: 'url(/tloappdsm.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#1a1e27'
  }

  const isChairAny = units.some(u => u.my_role === 'chair' || u.my_role === 'vice')

  function toggleOfficial() {
    const next = !officialMode
    setOfficialMode(next)
    try { localStorage.setItem('dsm_official_mode', JSON.stringify(next)) } catch {}
  }

  function handleSaveSettings() {
    try { localStorage.setItem('dsm_official_mode', JSON.stringify(officialMode)) } catch {}
    setSaveAnimation(true)
    setTimeout(() => setSaveAnimation(false), 1500)
  }

  if (!me) return <div className="min-h-screen text-slate-400 flex items-center justify-center" style={bgStyle}><p className="animate-pulse">Ładowanie panelu głosowania...</p></div>
  const ogolne = units.find(u => u.id === 'ogolne')
  const rest = units.filter(u => u.id !== 'ogolne')

  return (
    <>
      <Head><title>Panel Radnego – Dolnośląski Sejmik Młodzieży</title></Head>
      <div className="min-h-screen font-sans pb-12" style={bgStyle}>
        <header className="bg-[#1e2330] border-b border-[#3a4155] sticky top-0 z-20">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={LOGO} alt="DSM" className="w-8 h-8 object-contain rounded-lg" onError={e => { e.target.src = '/icons/system-glosowania.jpg' }} />
              <span className="font-semibold text-sm hidden sm:block text-[#e8eaf0]">Dolnośląski Sejmik Młodzieży</span>
            </div>
            <div className="flex items-center gap-2">
              {isChairAny && (
                <button onClick={() => setShowSettings(s => !s)} title="Ustawienia"
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              {open && !showSettings && (
                <button
                  onClick={() => setView(view === 'live' ? 'historia' : 'live')}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-slate-600"
                >
                  {view === 'live' ? <>📜 Historia</> : <>← Wróć</>}
                </button>
              )}
              <button onClick={logout} title="Wyloguj" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-3 sm:px-4 mt-4 sm:mt-6">
          {showSettings ? (
            <div className="max-w-lg mx-auto">
              <button onClick={() => setShowSettings(false)} className="text-sm text-slate-400 mb-3">← Wróć</button>
              <div className="rounded-2xl border shadow-sm p-6 space-y-6 bg-[#252b38] border-[#3a4155]">
                <h2 className="text-lg font-bold text-[#e8eaf0]">Ustawienia wyświetlania</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-[#e8eaf0]">Tryb Oficjalny</p>
                    <p className="text-xs text-[#8892a4]">Oficjalny wygląd wyników z herbem i statystykami</p>
                  </div>
                  <button type="button" onClick={toggleOfficial} className={`w-12 h-7 rounded-full relative ${officialMode ? 'bg-emerald-600' : 'bg-[#3a4155]'}`}>
                    <span className={`absolute top-1 block w-5 h-5 bg-white rounded-full shadow-md ${officialMode ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
                <div className="rounded-xl p-4 text-xs border bg-[#1e2330] text-[#8892a4] border-[#3a4155]">
                  <p className="font-semibold mb-1">Podpowiedź:</p>
                  <p>Tryb oficjalny zmienia wygląd wyników głosowań na Twoim urządzeniu.</p>
                </div>
                <button onClick={handleSaveSettings} className={`w-full font-bold py-3 rounded-xl shadow-lg text-white ${saveAnimation ? 'bg-green-500' : 'bg-brand-600 hover:bg-brand-700'}`}>
                  {saveAnimation ? '✓ Zapisano!' : '💾 Zapisz ustawienia'}
                </button>
              </div>
            </div>
          ) : !open ? (
            <>
              <div className="flex items-center gap-2.5 mb-1">
                {me.avatar_url ? (
                  <img src={me.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-600" onError={e => { e.target.style.display = 'none' }} />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center border border-brand-200">
                    {(me.name || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-slate-400 text-xs">Zalogowany:</p>
                  <p className="text-slate-200 text-sm font-bold leading-tight">{me.name}{me.title ? <span className="text-brand-400"> · {me.title}</span> : ''}</p>
                </div>
              </div>
              <p className="text-slate-500 text-xs mb-3">Wybierz komisję, w której chcesz głosować:</p>
              {ogolne && (
                <button onClick={() => pick(ogolne)} className="w-full text-left rounded-2xl p-4 mb-3 flex items-center gap-3 text-slate-900 bg-[#F2C14E]">
                  <div className="bg-white rounded-2xl p-1"><UnitIcon unit={ogolne} size={60} /></div>
                  <div><p className="font-black text-lg">OGÓLNE</p><p className="text-sm opacity-80">cały sejmik</p></div>
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                {rest.map(u => (
                  <button key={u.id} onClick={() => pick(u)} className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-left border-t-4" style={{ borderTopColor: colorFor(u) }}>
                    <UnitIcon unit={u} size={52} />
                    <p className="text-white font-bold mt-2">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.type === 'dzial' ? 'Dział' : 'Komisja'}{u.my_role === 'chair' ? ' · ★ prowadzący' : u.my_role === 'vice' ? ' · ☆ wice' : ''}</p>
                  </button>
                ))}
              </div>
              {rest.length === 0 && !ogolne && <p className="text-slate-500 text-sm mt-4">Nie przypisano Cię jeszcze do żadnej komisji. Zgłoś się do administratora.</p>}
              <div className="mt-6 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
                <p className="text-slate-300 text-sm font-bold mb-2">Zmień hasło</p>
                <div className="flex gap-2">
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Nowe hasło (min. 8 znaków)" className="flex-1 px-3 py-2 rounded-xl bg-slate-900 text-white border border-slate-700 text-sm" />
                  <button onClick={changePw} className="bg-brand-500 text-white font-bold px-4 rounded-xl text-sm">Zmień</button>
                </div>
                {pwMsg && <p className="text-sm text-slate-300 mt-2">{pwMsg}</p>}
              </div>
              <p className="text-center text-xs text-slate-600 mt-6">System głosowania DSM · <a className="underline" href="/robo">RODO</a></p>
            </>
          ) : view === 'historia' ? (
            <>
              <p className="text-sm font-bold text-slate-200 mb-3">Historia głosowań — {open.name}</p>
              <TabHistoria unit={open} hist={hist} official={officialMode} />
            </>
          ) : (
            <Room unit={open} back={() => setOpen(null)} goHist={() => setView('historia')} official={officialMode} />
          )}
        </main>
      </div>
    </>
  )
}
