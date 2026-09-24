import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import UnitIcon, { colorFor } from '../components/UnitIcon'

const LOGO = 'https://mlodziezowysejmik.pl/wp-content/uploads/2026/06/logoDSM.png'

const api = (url, opts) => fetch(url, opts).then(async r => {
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Błąd')
  return j
})

// Wybór komisji (wspólny dla zakładek) — 1:1 styl v1
function UnitPicker({ units, value, onChange, darkMode, allowAll }) {
  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <span className={`text-xs font-semibold ${darkMode ? 'text-[#8892a4]' : 'text-slate-500'}`}>Komisja:</span>
      {allowAll && (
        <button onClick={() => onChange('__all')} className={`px-3 py-1.5 rounded-full text-xs font-bold ${value === '__all' ? 'bg-brand-500 text-white' : darkMode ? 'bg-[#1e2330] text-[#b0bac8] border border-[#3a4155]' : 'bg-white text-slate-600 border border-slate-200'}`}>Wszystkie</button>
      )}
      {units.map(u => (
        <button key={u.id} onClick={() => onChange(u.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${value === u.id ? 'bg-brand-500 text-white' : darkMode ? 'bg-[#1e2330] text-[#b0bac8] border border-[#3a4155]' : 'bg-white text-slate-600 border border-slate-200'}`}>
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: colorFor(u) }} />{u.name}
        </button>
      ))}
    </div>
  )
}

// ==================== TAB WYNIKI (oficjalny ekran, styl v1) ====================
function TabWyniki({ darkMode, officialMode, units }) {
  const [unitId, setUnitId] = useState('ogolne')
  const [voting, setVoting] = useState(null)
  const [results, setResults] = useState(null)
  const [votedCount, setVotedCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  async function load() {
    try {
      const cur = await api(`/api/votings/current?unit_id=${unitId}&t=${Date.now()}`)
      if (cur.voting) {
        setVoting(cur.voting); setResults(cur.results); setVotedCount(cur.voted_count || 0)
        return
      }
      const h = await api(`/api/votings/history?unit_id=${unitId}`)
      const first = (h.votings || [])[0]
      if (first) { setVoting(first); setResults(first.results); setVotedCount(first.voted_count || 0) }
      else { setVoting(null); setResults(null); setVotedCount(0) }
    } catch {}
  }

  useEffect(() => { setIsVisible(true) }, [])
  useEffect(() => { load(); const t = setInterval(load, 2000); return () => clearInterval(t) }, [unitId])

  const unit = units.find(u => u.id === unitId)

  if (!voting) {
    return (
      <div className={`p-8 text-center text-sm ${darkMode ? 'text-[#8892a4]' : 'text-slate-500'}`}>
        <UnitPicker units={units} value={unitId} onChange={setUnitId} darkMode={darkMode} />
        <div className="text-4xl mb-3 animate-bounce">📋</div>
        <p className="font-semibold">Brak głosowania do wyświetlenia</p>
        <p className="mt-1">Utwórz nowe głosowanie w zakładce „Głosowania"</p>
      </div>
    )
  }

  const isClassic = voting.voting_type === 'classic' || !voting.voting_type
  const secret = !!voting.is_secret
  const eligible = voting.eligible_count || 0
  const rows = !secret && Array.isArray(results) ? results : []
  const counts = secret && results && results.counts ? results.counts : null

  const zaCount = secret ? (counts?.find(c => c.label === 'ZA')?.n || 0) : rows.filter(v => v.choice === 'ZA').length
  const przeciwCount = secret ? (counts?.find(c => c.label === 'PRZECIW')?.n || 0) : rows.filter(v => v.choice === 'PRZECIW').length
  const wstrzCount = secret ? (counts?.find(c => c.label === 'WSTRZ')?.n || 0) : rows.filter(v => v.choice === 'WSTRZ').length
  const totalClassic = zaCount + przeciwCount + wstrzCount
  const missing = Math.max(0, eligible - (isClassic ? totalClassic : votedCount))
  const kworum = Math.floor(eligible / 2) + 1
  const maxScale = Math.max(eligible, 1)

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

  const dateStr = voting.created_at
    ? new Date(voting.created_at).toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')
    : '—'

  const werdykt = (() => {
    if (isClassic) {
      if (totalClassic === 0) return 'Brak głosów'
      if (totalClassic < kworum) return 'Odrzucono'
      if (przeciwCount === 0 && wstrzCount === 0 && zaCount >= kworum) return 'Przyjęto\njednomyślnie'
      if (zaCount > przeciwCount && zaCount >= kworum) return 'Przyjęto'
      if (zaCount < przeciwCount) return 'Odrzucono'
      return 'Remis'
    }
    if (optTotal === 0) return 'Brak głosów'
    const sorted = Object.entries(optCounts).sort((a, b) => b[1] - a[1])
    return `Wygrywa:\n${sorted[0][0]}\n(${sorted[0][1]} głosów)`
  })()

  const namesFor = (opt) => rows.filter(v => v.choice === opt || (v.choices && v.choices.includes(opt))).map(v => v.name || 'Nieznany')

  if (!officialMode) {
    return (
      <div className={`p-4 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <UnitPicker units={units} value={unitId} onChange={setUnitId} darkMode={darkMode} />
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${darkMode ? 'bg-[#252b38] border-[#3a4155]' : 'bg-white border-slate-100'}`}>
          <div className={`px-5 py-3 flex items-center justify-between ${voting.is_active !== false ? 'bg-gradient-to-r from-green-600 to-emerald-500' : 'bg-gradient-to-r from-slate-600 to-slate-500'}`}>
            <div className="flex items-center gap-2">
              {voting.is_active !== false && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
              <span className="text-white font-semibold text-sm">{voting.is_active !== false ? 'NA ŻYWO' : 'ZAKOŃCZONE'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white">{secret ? '🔒 Tajne' : 'Jawne'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white ml-1">{isClassic ? 'Klasyczne' : voting.voting_type === 'single_choice' ? 'Pojedynczy' : 'Wielokrotny wybór'}</span>
            </div>
          </div>
          <div className="p-5">
            <p className={`font-bold text-base mb-1 leading-snug break-words ${darkMode ? 'text-[#e8eaf0]' : 'text-slate-900'}`}>{voting.question}</p>
            <p className={`text-xs mb-4 ${darkMode ? 'text-[#8892a4]' : 'text-slate-500'}`}>{unit?.name || ''} · frekwencja {votedCount}/{eligible}</p>
            {isClassic ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'ZA', val: zaCount, bg: darkMode ? 'bg-[#1a3a1a]' : 'bg-green-50', border: darkMode ? 'border-green-500/30' : 'border-green-200', num: 'text-green-400' },
                    { label: 'WSTRZ.', val: wstrzCount, bg: darkMode ? 'bg-[#2c3344]' : 'bg-slate-50', border: darkMode ? 'border-[#3a4155]' : 'border-slate-200', num: darkMode ? 'text-[#8892a4]' : 'text-slate-600' },
                    { label: 'PRZECIW', val: przeciwCount, bg: darkMode ? 'bg-[#3a1a1a]' : 'bg-red-50', border: darkMode ? 'border-red-500/30' : 'border-red-200', num: 'text-red-400' },
                  ].map(r => (
                    <div key={r.label} className={`${r.bg} border-2 ${r.border} rounded-2xl p-4 text-center`}>
                      <div className={`text-4xl font-extrabold ${r.num} leading-none`}>{r.val}</div>
                      <div className={`text-xs font-bold mt-1.5 uppercase tracking-wide ${darkMode ? 'text-[#8892a4]' : 'text-slate-500'}`}>{r.label}</div>
                    </div>
                  ))}
                </div>
                {totalClassic > 0 && (
                  <div className={`h-2.5 rounded-full overflow-hidden flex mb-3 ${darkMode ? 'bg-[#1e2330]' : 'bg-slate-100'}`}>
                    <div className="bg-green-500" style={{ width: `${(zaCount / totalClassic) * 100}%` }} />
                    <div className="bg-slate-400" style={{ width: `${(wstrzCount / totalClassic) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(przeciwCount / totalClassic) * 100}%` }} />
                  </div>
                )}
                <p className={`text-xs text-center ${darkMode ? 'text-[#8892a4]' : 'text-slate-500'}`}>Łącznie głosów: <strong>{totalClassic}</strong></p>
              </>
            ) : (
              <div className="space-y-3">
                {opts.map((opt, idx) => {
                  const count = optCounts[opt] || 0
                  const pct = optTotal > 0 ? Math.round((count / optTotal) * 100) : 0
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-24 md:w-32 text-right text-xs font-bold uppercase shrink-0 ${darkMode ? 'text-[#b0bac8]' : 'text-slate-600'}`}>{opt}</div>
                      <div className={`flex-1 h-7 rounded overflow-hidden relative ${darkMode ? 'bg-[#1e2330]' : 'bg-slate-100'}`}>
                        <div className="h-full bg-brand-500 rounded flex items-center justify-end px-2 text-white font-bold text-xs" style={{ width: `${Math.max(pct, 2)}%`, minWidth: count > 0 ? '1.5rem' : '0' }}>{count > 0 && count}</div>
                      </div>
                      <div className="w-8 text-right font-bold text-sm text-white">{count}</div>
                      <div className="w-12 text-right text-xs text-[#8892a4]">({pct}%)</div>
                    </div>
                  )
                })}
                <p className={`text-xs text-center pt-2 ${darkMode ? 'text-[#8892a4]' : 'text-slate-500'}`}>Łącznie głosów: <strong>{optTotal}</strong> · Głosujących: <strong>{votedCount}</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // TRYB OFICJALNY
  const barRows = isClassic ? [
    { label: 'ZA', val: zaCount, color: '#2ecc71' },
    { label: 'PRZECIW', val: przeciwCount, color: '#e74c3c' },
    { label: 'WSTRZYMAŁO SIĘ', val: wstrzCount, color: '#7f8c8d' },
    { label: 'Brak głosu', val: missing, color: '#3498db' },
  ] : opts.map(opt => ({ label: opt, val: optCounts[opt] || 0, color: '#e67e22' }))

  const stats = [
    { icon: '🔒', val: eligible, lbl: 'Uprawnieni', bg: darkMode ? '#3a4155' : '#e2e8f0', col: darkMode ? '#e8eaf0' : '#334155' },
    { icon: '🗳️', val: isClassic ? totalClassic : optTotal, lbl: 'Wszystkie głosy', bg: darkMode ? '#3a2a1a' : '#fff7ed', col: '#e67e22' },
    { icon: 'K', val: kworum, lbl: 'Kworum', bg: darkMode ? '#3a4155' : '#e2e8f0', col: darkMode ? '#e8eaf0' : '#334155' },
  ]

  return (
    <div className={`official-results ${!darkMode ? 'official-results-light' : ''} space-y-4 p-4 pb-20 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <UnitPicker units={units} value={unitId} onChange={setUnitId} darkMode={darkMode} />
      <div className="bg-[#1a1e27] border border-[#3a4155] rounded-xl p-5 md:p-6 flex items-center gap-4 md:gap-6 relative overflow-hidden">
        <img src={LOGO} alt="DSM" className="h-14 md:h-20 object-contain relative z-10 shrink-0" onError={e => { e.target.src = '/icons/system-glosowania.jpg' }} />
        <div className="w-px h-12 md:h-16 bg-[#3a4155] relative z-10 shrink-0" />
        <div className="relative z-10 min-w-0">
          <div className="text-white font-black text-xl md:text-3xl tracking-wider leading-none">DOLNOŚLĄSKI</div>
          <div className="text-white font-black text-xl md:text-3xl tracking-wider leading-none mt-0.5 md:mt-1">SEJMIK MŁODZIEŻY</div>
          <div className="text-[#b0bac8] font-bold text-[10px] md:text-sm tracking-[0.15em] md:tracking-[0.2em] mt-1.5 md:mt-2 uppercase">Sejmik Województwa Dolnośląskiego</div>
        </div>
      </div>

      <div className="bg-[#252b38] border border-[#3a4155] rounded-xl p-4 md:p-6">
        <div className="text-xs md:text-[13px] font-extrabold tracking-wider text-white mb-1">
          WYNIKI GŁOSOWANIA{' '}
          <span className="font-normal text-[#8892a4]">({secret ? 'Tajne' : 'Jawne'} · {isClassic ? 'Klasyczne' : voting.voting_type === 'single_choice' ? 'Pojedynczy wybór' : 'Wielokrotny wybór'})</span>
        </div>
        <div className="text-xs text-[#8892a4] mb-1">{unit?.name || ''}</div>
        <div className="text-xs text-[#8892a4] mb-5 leading-relaxed break-words">{voting.question}</div>

        <div className="bg-[#2c3344] border border-[#3a4155] rounded-lg p-3 md:p-4 flex flex-col md:flex-row gap-3 md:gap-4 mb-5">
          <div className="md:min-w-[130px] md:border-r md:border-[#3a4155] md:pr-5 flex flex-col justify-center pb-3 md:pb-0 border-b md:border-b-0 border-[#3a4155]">
            <div className="text-[11px] text-[#8892a4] mb-1">{dateStr}</div>
            <div className="text-base md:text-lg font-black text-white leading-tight whitespace-pre-line">{werdykt}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 md:gap-x-6 gap-y-2 md:gap-y-3 flex-1">
            {stats.map((s, i) => (
              <div key={i} className="flex items-center gap-2 md:gap-3">
                <div className="w-6 h-6 md:w-7 md:h-7 rounded-md flex items-center justify-center text-xs md:text-sm shrink-0" style={{ background: s.bg, color: s.col }}>{s.icon}</div>
                <div className="flex items-baseline gap-1 min-w-0">
                  <span className="text-sm md:text-[15px] font-bold text-white">{s.val}</span>
                  <span className="text-[10px] md:text-xs text-[#8892a4] truncate">{s.lbl}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 md:space-y-2.5">
          {barRows.map((row) => {
            const pct = ((row.val / maxScale) * 100).toFixed(1)
            return (
              <div key={row.label} className="flex items-center gap-2 md:gap-3">
                <div className="w-24 md:w-32 text-right text-[11px] md:text-[13px] font-bold text-[#b0bac8] uppercase shrink-0 max-sm:w-20 max-sm:text-left">{row.label}</div>
                <div className="flex-1 h-6 md:h-7 bg-[#1e2330] rounded overflow-hidden relative">
                  {row.val > 0 && (
                    <div className="h-full flex items-center justify-end px-2 text-white font-bold text-[11px] md:text-xs rounded" style={{ width: `${Math.max((row.val / maxScale) * 100, 2)}%`, backgroundColor: row.color, minWidth: '1.5rem' }}>{row.val}</div>
                  )}
                </div>
                <div className="w-6 md:w-8 text-right font-bold text-sm md:text-[15px] text-white shrink-0">{row.val}</div>
                <div className="w-10 md:w-12 text-right text-xs md:text-[13px] text-[#8892a4] shrink-0">({pct}%)</div>
              </div>
            )
          })}
        </div>

        {!secret && !isClassic && (
          <div className="mt-5 md:mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {opts.map((opt, idx) => (
                <div key={idx}>
                  <div className="text-[10px] md:text-[11px] font-bold tracking-wider text-[#8892a4] mb-2 uppercase">{opt} – {optCounts[opt] || 0} głosów</div>
                  <div className="bg-[#1e2330] border border-[#3a4155] rounded-lg p-3 space-y-1 max-h-64 overflow-y-auto">
                    {namesFor(opt).length === 0 ? (
                      <div className="text-sm text-[#8892a4] italic">Brak</div>
                    ) : (
                      namesFor(opt).map((n, i) => (
                        <div key={i} className="text-sm text-[#e8eaf0] py-1 border-b border-[#3a4155]/30 last:border-0">{n}</div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {secret && (
          <div className="mt-5 md:mt-6 bg-[#1e2330] border border-purple-500/20 rounded-lg p-4 text-center">
            <p className="text-purple-400 text-sm font-semibold animate-pulse">🔒 Głosowanie tajne — lista nazwisk jest ukryta</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== TAB GŁOSOWANIA ====================
function TabGlosowania({ darkMode, units }) {
  const [unitId, setUnitId] = useState('ogolne')
  const [live, setLive] = useState(null)
  const [liveResults, setLiveResults] = useState(null)
  const [votedCount, setVotedCount] = useState(0)
  const [eligibleCount, setEligibleCount] = useState(0)
  const [question, setQuestion] = useState('')
  const [isSecret, setIsSecret] = useState(true)
  const [votingType, setVotingType] = useState('classic')
  const [options, setOptions] = useState(['', ''])
  const [maxVotes, setMaxVotes] = useState(1)
  const [creating, setCreating] = useState(false)
  const [openForm, setOpenForm] = useState(true)
  const [expandedCat, setExpandedCat] = useState(null)
  const [isVisible, setIsVisible] = useState(false)

  const optionsArr = options.map(s => s.trim()).filter(Boolean)

  async function loadLive() {
    try {
      const cur = await api(`/api/votings/current?unit_id=${unitId}&t=${Date.now()}`)
      if (cur.voting) {
        setLive(cur.voting); setLiveResults(cur.results)
        setVotedCount(cur.voted_count || 0); setEligibleCount(cur.voting.eligible_count || 0)
        return
      }
      const h = await api(`/api/votings/history?unit_id=${unitId}`)
      const last = (h.votings || [])[0]
      if (last) { setLive({ ...last, is_active: false }); setLiveResults(last.results); setVotedCount(last.voted_count || 0); setEligibleCount(last.eligible_count || 0) }
      else { setLive(null); setLiveResults(null) }
    } catch {}
  }

  useEffect(() => { setIsVisible(true) }, [])
  useEffect(() => { setExpandedCat(null); loadLive(); const t = setInterval(loadLive, 2000); return () => clearInterval(t) }, [unitId])

  async function startVoting(e) {
    e.preventDefault()
    if (!question.trim() || creating) return
    if (votingType !== 'classic' && optionsArr.length < 2) { alert('Dodaj co najmniej 2 opcje.'); return }
    setCreating(true)
    try {
      await api('/api/votings/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unit_id: unitId, question: question.trim(), is_secret: isSecret, voting_type: votingType, options: optionsArr, max_votes_per_user: Math.max(1, maxVotes) })
      })
      setQuestion(''); setOptions(['', '']); setMaxVotes(1); setVotingType('classic'); setExpandedCat(null)
      loadLive()
    } catch (err) { alert('Błąd tworzenia głosowania: ' + err.message) }
    setCreating(false)
  }

  async function closeVoting() {
    if (!live) return
    if (!confirm('Czy na pewno chcesz zakończyć to głosowanie?')) return
    try { await api('/api/votings/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voting_id: live.id }) }); setExpandedCat(null); loadLive() }
    catch (err) { alert('Błąd zamykania: ' + err.message) }
  }

  const isClassic = live?.voting_type === 'classic' || !live?.voting_type
  const secret = !!live?.is_secret
  const rows = !secret && Array.isArray(liveResults) ? liveResults : []
  const zaCount = rows.filter(v => v.choice === 'ZA').length
  const wstrzCount = rows.filter(v => v.choice === 'WSTRZ').length
  const przeciwCount = rows.filter(v => v.choice === 'PRZECIW').length
  const total = zaCount + wstrzCount + przeciwCount
  const pct = (n) => total > 0 ? Math.round(n / total * 100) : 0
  const namesFor = (c) => rows.filter(v => v.choice === c).map(v => v.name || 'Nieznany')
  const isLiveActive = live && live.is_active !== false
  const opts = Array.isArray(live?.options) ? live.options : []
  const oCounts = {}
  opts.forEach(o => { oCounts[o] = 0 })
  rows.forEach(v => {
    if (v.choices && Array.isArray(v.choices)) v.choices.forEach(c => { if (oCounts[c] !== undefined) oCounts[c]++ })
    else if (v.choice && oCounts[v.choice] !== undefined) oCounts[v.choice]++
  })

  const cardBg = darkMode ? 'bg-[#252b38] border-[#3a4155]' : 'bg-white border-slate-100'
  const textMain = darkMode ? 'text-[#e8eaf0]' : 'text-slate-900'
  const textMuted = darkMode ? 'text-[#8892a4]' : 'text-slate-500'
  const inputBg = darkMode ? 'bg-[#1e2330] border-[#3a4155] text-[#e8eaf0]' : 'bg-white border-slate-200 text-slate-900'
  const inputPlaceholder = darkMode ? 'placeholder:text-[#8892a4]' : 'placeholder:text-slate-400'

  return (
    <div className={`space-y-4 p-4 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      <UnitPicker units={units} value={unitId} onChange={setUnitId} darkMode={darkMode} />
      {live ? (
        <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardBg}`}>
          <div className={`px-5 py-3 flex items-center justify-between ${isLiveActive ? 'bg-gradient-to-r from-green-600 to-emerald-500' : 'bg-gradient-to-r from-slate-600 to-slate-500'}`}>
            <div className="flex items-center gap-2">
              {isLiveActive && <span className="w-2 h-2 bg-white rounded-full animate-pulse" />}
              <span className="text-white font-semibold text-sm">{isLiveActive ? 'NA ŻYWO' : 'ZAKOŃCZONE'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white">{secret ? '🔒 Tajne' : 'Jawne'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white ml-1">{isClassic ? 'Klasyczne' : live.voting_type === 'single_choice' ? 'Pojedynczy' : 'Wielokrotny wybór'}</span>
            </div>
            {isLiveActive && (
              <button onClick={closeVoting} className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg">✕ Zamknij</button>
            )}
          </div>
          <div className="p-5">
            <p className={`font-bold text-base mb-1 leading-snug break-words ${textMain}`}>{live.question}</p>
            <p className={`text-xs mb-4 ${textMuted}`}>Zagłosowało {votedCount}/{eligibleCount}</p>
            {isClassic ? (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'ZA', val: zaCount, bg: darkMode ? 'bg-[#1a3a1a]' : 'bg-green-50', border: darkMode ? 'border-green-500/30' : 'border-green-200', num: 'text-green-400', cat: 'ZA' },
                    { label: 'WSTRZ.', val: wstrzCount, bg: darkMode ? 'bg-[#2c3344]' : 'bg-slate-50', border: darkMode ? 'border-[#3a4155]' : 'border-slate-200', num: darkMode ? 'text-[#8892a4]' : 'text-slate-600', cat: 'WSTRZ' },
                    { label: 'PRZECIW', val: przeciwCount, bg: darkMode ? 'bg-[#3a1a1a]' : 'bg-red-50', border: darkMode ? 'border-red-500/30' : 'border-red-200', num: 'text-red-400', cat: 'PRZECIW' },
                  ].map(r => (
                    <button key={r.cat} onClick={() => !secret && setExpandedCat(expandedCat === r.cat ? null : r.cat)}
                      className={`${r.bg} border-2 ${r.border} rounded-2xl p-4 text-center ${!secret ? 'hover:shadow-md cursor-pointer hover:scale-105' : 'cursor-default'} ${expandedCat === r.cat ? 'ring-2 ring-brand-400' : ''}`}>
                      <div className={`text-4xl font-extrabold ${r.num} leading-none`}>{r.val}</div>
                      <div className={`text-xs font-bold mt-1.5 ${textMuted} uppercase tracking-wide`}>{r.label}</div>
                      <div className={`text-xs ${textMuted} mt-0.5`}>{pct(r.val)}%</div>
                      {!secret && <div className={`text-xs ${textMuted} mt-1`}>{expandedCat === r.cat ? '▲ zwiń' : '▼ kto?'}</div>}
                    </button>
                  ))}
                </div>
                {total > 0 && (
                  <div className={`h-2.5 rounded-full overflow-hidden flex mb-3 ${darkMode ? 'bg-[#1e2330]' : 'bg-slate-100'}`}>
                    <div className="bg-green-500" style={{ width: `${pct(zaCount)}%` }} />
                    <div className="bg-slate-400" style={{ width: `${pct(wstrzCount)}%` }} />
                    <div className="bg-red-500" style={{ width: `${pct(przeciwCount)}%` }} />
                  </div>
                )}
                <p className={`text-xs text-center ${textMuted}`}>Łącznie głosów: <strong>{total}</strong></p>
                {!secret && expandedCat && (
                  <div className={`mt-4 border-t pt-4 ${darkMode ? 'border-[#3a4155]' : 'border-slate-100'}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${textMuted}`}>Kto głosował:</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {namesFor(expandedCat).length === 0 ? <p className="text-sm italic text-[#8892a4]">Brak głosów</p> :
                        namesFor(expandedCat).map((name, i) => (
                          <div key={i} className={`rounded-xl px-3 py-2 ${darkMode ? 'bg-[#1e2330]' : 'bg-slate-50'}`}><span className={`text-sm font-medium ${textMain}`}>{name}</span></div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                {opts.map((opt, idx) => {
                  const count = oCounts[opt] || 0
                  const optPct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-24 md:w-32 text-right text-xs font-bold uppercase shrink-0 ${darkMode ? 'text-[#b0bac8]' : 'text-slate-600'}`}>{opt}</div>
                      <div className={`flex-1 h-7 rounded overflow-hidden relative ${darkMode ? 'bg-[#1e2330]' : 'bg-slate-100'}`}>
                        <div className="h-full bg-brand-500 rounded flex items-center justify-end px-2 text-white font-bold text-xs" style={{ width: `${Math.max(optPct, 2)}%`, minWidth: count > 0 ? '1.5rem' : '0' }}>{count > 0 && count}</div>
                      </div>
                      <div className="w-8 text-right font-bold text-sm text-white">{count}</div>
                      <div className="w-12 text-right text-xs text-[#8892a4]">({optPct}%)</div>
                    </div>
                  )
                })}
                <p className={`text-xs text-center pt-2 ${textMuted}`}>Łącznie głosów: <strong>{total}</strong></p>
              </div>
            )}
            {secret && total > 0 && isClassic && (
              <div className={`mt-4 border-t pt-4 text-center ${darkMode ? 'border-[#3a4155]' : 'border-slate-100'}`}>
                <p className="text-xs text-purple-500 italic animate-pulse">🔒 Głosowanie tajne — nazwiska są ukryte</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`rounded-2xl border-2 border-dashed p-10 text-center ${darkMode ? 'bg-[#252b38] border-[#3a4155]' : 'bg-white border-slate-200'}`}>
          <div className="text-4xl mb-3 animate-bounce">📋</div>
          <p className={`font-semibold ${textMuted}`}>Brak aktywnego głosowania</p>
          <p className={`text-sm mt-1 ${textMuted}`}>Utwórz nowe głosowanie poniżej</p>
        </div>
      )}

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardBg}`}>
        <button onClick={() => setOpenForm(!openForm)} className={`w-full flex items-center justify-between px-5 py-4 ${darkMode ? 'hover:bg-[#2c3344]' : 'hover:bg-slate-50'}`}>
          <span className={`font-semibold ${textMain}`}>＋ Nowe głosowanie</span>
          <svg className={`w-5 h-5 ${textMuted} ${openForm ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div className={`overflow-hidden ${openForm ? 'max-h-[6000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <form onSubmit={startVoting} className={`border-t p-5 space-y-4 ${darkMode ? 'border-[#3a4155]' : 'border-slate-100'}`}>
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-[#b0bac8]' : 'text-slate-700'}`}>Treść pytania</label>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="np. Uchwała nr 42 w sprawie budżetu na 2025 rok" rows={3}
                className={`w-full px-4 py-3 border rounded-xl focus:border-brand-500 focus:outline-none resize-none text-sm ${inputBg} ${inputPlaceholder}`} />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-[#b0bac8]' : 'text-slate-700'}`}>Format głosowania</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setVotingType('classic')}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold flex flex-col items-center gap-1 ${votingType === 'classic' ? 'border-brand-500 bg-brand-50 text-brand-800' : darkMode ? 'border-[#3a4155] text-[#8892a4]' : 'border-slate-200 text-slate-500'}`}>
                  <span className="text-xl">✕</span><span>Klasyczne</span><span className="text-[10px] opacity-70 font-normal">(Tak/Nie/Wstrz)</span>
                </button>
                <button type="button" onClick={() => setVotingType('single_choice')}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold flex flex-col items-center gap-1 ${votingType === 'single_choice' ? 'border-brand-500 bg-brand-50 text-brand-800' : darkMode ? 'border-[#3a4155] text-[#8892a4]' : 'border-slate-200 text-slate-500'}`}>
                  <span className="text-xl">👤</span><span>Pojedynczy</span><span className="text-[10px] opacity-70 font-normal">Wybór</span>
                </button>
                <button type="button" onClick={() => setVotingType('multi_choice')}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold flex flex-col items-center gap-1 ${votingType === 'multi_choice' ? 'border-brand-500 bg-brand-50 text-brand-800' : darkMode ? 'border-[#3a4155] text-[#8892a4]' : 'border-slate-200 text-slate-500'}`}>
                  <span className="text-xl">👥</span><span>Personalne</span><span className="text-[10px] opacity-70 font-normal">(Wielokrotny wybór)</span>
                </button>
              </div>
            </div>
            {votingType !== 'classic' && (
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input type="text" value={opt} onChange={e => { const n = [...options]; n[idx] = e.target.value; setOptions(n) }} placeholder={`Opcja ${idx + 1}`}
                      className={`flex-1 px-4 py-2.5 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg} ${inputPlaceholder}`} />
                    {options.length > 2 && (
                      <button type="button" onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                        className={`p-2.5 rounded-xl text-sm font-bold ${darkMode ? 'bg-[#3a1a1a] text-red-400' : 'bg-red-50 text-red-600'}`}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setOptions([...options, ''])}
                  className={`mt-2 w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold ${darkMode ? 'border-[#3a4155] text-[#8892a4]' : 'border-slate-300 text-slate-500'}`}>＋ Dodaj kolejną opcję</button>
              </div>
            )}
            {votingType === 'multi_choice' && (
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-[#b0bac8]' : 'text-slate-700'}`}>Liczba głosów na osobę:</label>
                <input type="number" min={1} value={maxVotes} onChange={e => setMaxVotes(Math.max(1, parseInt(e.target.value) || 1))}
                  className={`w-full px-4 py-3 border rounded-xl focus:border-brand-500 focus:outline-none text-sm ${inputBg}`} />
              </div>
            )}
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${darkMode ? 'text-[#b0bac8]' : 'text-slate-700'}`}>Tryb głosowania</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setIsSecret(true)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold ${isSecret ? 'border-purple-400 bg-purple-50 text-purple-800' : darkMode ? 'border-[#3a4155] text-[#8892a4]' : 'border-slate-200 text-slate-500'}`}>🔒 Tajne</button>
                <button type="button" onClick={() => setIsSecret(false)}
                  className={`p-3 rounded-xl border-2 text-sm font-semibold ${!isSecret ? 'border-blue-400 bg-blue-50 text-blue-800' : darkMode ? 'border-[#3a4155] text-[#8892a4]' : 'border-slate-200 text-slate-500'}`}>Jawne</button>
              </div>
            </div>
            <button type="submit" disabled={creating || !question.trim() || (votingType !== 'classic' && optionsArr.length < 2)}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl shadow-lg">
              {creating ? '⏳ Uruchamianie...' : '▶ Uruchom głosowanie'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ==================== TAB UŻYTKOWNICY ====================
const STANOWISKA = ['Przewodniczący Sejmiku', 'Wiceprzewodniczący', 'Wiceprzewodnicząca', 'Sekretarz']

function TabUzytkownicy({ darkMode, units, onChanged }) {
  const [users, setUsers] = useState([])
  const [editing, setEditing] = useState(null)
  const [newU, setNewU] = useState({ name: '', code: '', email: '', role: 'radny' })
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tempPw, setTempPw] = useState(null)

  async function load() {
    try { const j = await api('/api/admin/users'); setUsers(j.users || []) } catch {}
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      await api('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing.id, name: editing.name, login: editing.login, avatar_url: editing.avatar_url || '', title: editing.title || '', email: editing.email || '' }) })
      // Przewodniczący Sejmiku = od razu ★ w Ogólnych (uprawnienia), o ile jeszcze nie ma
      if ((editing.title || '') === 'Przewodniczący Sejmiku') {
        for (let i = 0; i < 3; i++) {
          const j = await api('/api/admin/users').catch(() => null)
          const me = j && (j.users || []).find(x => x.id === editing.id)
          const role = me && (me.memberships || []).find(m => m.unit_id === 'ogolne')?.role
          if (role === 'chair') break
          await api('/api/admin/memberships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: editing.id, unit_id: 'ogolne' }) })
        }
      }
      setEditing(null); load(); onChanged && onChanged()
    } catch (err) { alert('Błąd zapisu: ' + err.message) }
    setSaving(false)
  }

  async function cycleUnit(userId, unitId) {
    try { await api('/api/admin/memberships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, unit_id: unitId }) }); load(); onChanged && onChanged() }
    catch (err) { alert('Błąd: ' + err.message) }
  }

  async function addUser() {
    if (!newU.name && !newU.code) { alert('Podaj imię lub kod'); return }
    setSaving(true)
    try {
      const j = await api('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: newU.code, name: newU.name, email: newU.email }) })
      if (newU.role === 'admin') await api('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: j.id, is_admin: true }) })
      setTempPw({ login: j.login, pw: j.temp_password })
      setNewU({ name: '', code: '', email: '', role: 'radny' }); setShowAdd(false); load(); onChanged && onChanged()
    } catch (err) { alert('Błąd dodawania: ' + err.message) }
    setSaving(false)
  }

  async function del(id) {
    if (!confirm('Usunąć użytkownika?')) return
    try { await api('/api/admin/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load(); onChanged && onChanged() }
    catch (err) { alert('Błąd: ' + err.message) }
  }

  async function toggleActive(u) {
    try { await api('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, is_active: !u.is_active }) }); load() }
    catch (err) { alert('Błąd: ' + err.message) }
  }

  async function newPassword(u) {
    if (!confirm(`Wygenerować nowe hasło dla ${u.name}? Stare przestanie działać.`)) return
    try {
      const j = await api('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, set_temp_password: true }) })
      setTempPw({ login: u.login, pw: j.temp_password })
    } catch (err) { alert('Błąd: ' + err.message) }
  }

  const radni = users.filter(u => !u.is_admin)
  const admins = users.filter(u => u.is_admin)
  const initials = (n) => (n || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()

  const cardBg = darkMode ? 'bg-[#252b38] border-[#3a4155]' : 'bg-white border-slate-100'
  const textMain = darkMode ? 'text-[#e8eaf0]' : 'text-slate-900'
  const textMuted = darkMode ? 'text-[#8892a4]' : 'text-slate-500'
  const inputBg = darkMode ? 'bg-[#1e2330] border-[#3a4155] text-[#e8eaf0]' : 'bg-white border-slate-200 text-slate-900'

  return (
    <div className="p-4 space-y-4">
      {tempPw && (
        <div className={`rounded-2xl border-2 border-dashed p-4 ${darkMode ? 'bg-[#1e2330] border-brand-500/50' : 'bg-brand-50 border-brand-300'}`}>
          <p className={`text-sm font-bold ${textMain}`}>🔑 Hasło tymczasowe (pokazane TYLKO raz — podyktuj / wydrukuj):</p>
          <p className={`font-mono mt-1 ${textMain}`}>login: <b>{tempPw.login}</b> · hasło: <b>{tempPw.pw}</b></p>
          <button onClick={() => setTempPw(null)} className={`text-xs mt-1 underline ${textMuted}`}>Ukryj</button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className={`text-sm ${textMuted}`}><strong>{radni.length}</strong> radnych · <strong>{admins.length}</strong> admin</p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl">+ Dodaj</button>
      </div>

      <div className={`overflow-hidden ${showAdd ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className={`rounded-2xl border p-4 space-y-3 ${darkMode ? 'bg-[#1e2330] border-[#3a4155]' : 'bg-brand-50 border-brand-200'}`}>
          <p className={`font-semibold text-sm ${darkMode ? 'text-[#e8eaf0]' : 'text-brand-800'}`}>Nowy użytkownik</p>
          <input value={newU.name} onChange={e => setNewU({ ...newU, name: e.target.value })} placeholder="Imię i nazwisko" className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`} />
          <input value={newU.code} onChange={e => setNewU({ ...newU, code: e.target.value })} placeholder="Kod (np. RADNY008)" className={`w-full px-3 py-2.5 border rounded-xl text-sm font-mono focus:border-brand-500 focus:outline-none ${inputBg}`} />
          <input type="email" value={newU.email} onChange={e => setNewU({ ...newU, email: e.target.value })} placeholder="E-mail do resetu hasła (opcjonalnie)" className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`} />
          <select value={newU.role} onChange={e => setNewU({ ...newU, role: e.target.value })} className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`}>
            <option value="radny">Radny</option>
            <option value="admin">Administrator</option>
          </select>
          <button onClick={addUser} disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">{saving ? 'Dodawanie...' : 'Dodaj użytkownika'}</button>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm divide-y overflow-hidden ${cardBg} ${darkMode ? 'divide-[#3a4155]' : 'divide-slate-50'}`}>
        {users.map(u => (
          <div key={u.id} className="px-4 py-3">
            {editing?.id === u.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Imię i nazwisko" className={`px-3 py-2 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`} />
                  <input value={editing.login} onChange={e => setEditing({ ...editing, login: e.target.value })} placeholder="Kod logowania" className={`px-3 py-2 border rounded-xl text-sm font-mono focus:border-brand-500 focus:outline-none ${inputBg}`} />
                </div>
                <input value={editing.avatar_url || ''} onChange={e => setEditing({ ...editing, avatar_url: e.target.value })} placeholder="Link do zdjęcia (opcjonalne)" className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`} />
                <input type="email" value={editing.email || ''} onChange={e => setEditing({ ...editing, email: e.target.value })} placeholder="E-mail do resetu hasła (puste = brak)" className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`} />
                {editing.avatar_url && (
                  <div className="flex items-center gap-2">
                    <img src={editing.avatar_url} alt="Podgląd" className="w-10 h-10 rounded-full object-cover border border-slate-200" onError={e => { e.target.style.display = 'none' }} />
                    <span className={`text-xs ${textMuted}`}>Podgląd zdjęcia</span>
                  </div>
                )}
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Funkcja / stanowisko</label>
                  <input value={editing.title || ''} list="stanowiska-dsm" onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="np. Sekretarz (puste = brak)" className={`w-full px-3 py-2 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`} />
                  <datalist id="stanowiska-dsm">
                    {STANOWISKA.map(s => <option key={s} value={s} />)}
                  </datalist>
                  <p className={`text-[11px] mt-1 ${textMuted}`}>„Przewodniczący Sejmiku" daje od razu ★ w Ogólnych.</p>
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Komisje (klik = ✓ członek → ★ przew. → ☆ wice → usuń)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(units || []).map(x => {
                      const r = (u.memberships || []).find(m => m.unit_id === x.id)?.role
                      return (
                        <button key={x.id} type="button" onClick={() => cycleUnit(u.id, x.id)} title={x.name}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${r === 'chair' ? 'bg-brand-500 text-white' : r === 'vice' ? 'bg-sky-600 text-white' : r === 'member' ? 'bg-emerald-600 text-white' : darkMode ? 'bg-[#1e2330] text-[#8892a4] border border-[#3a4155]' : 'bg-slate-100 text-slate-500'}`}>
                          {r === 'chair' ? `★ ${x.name}` : r === 'vice' ? `☆ ${x.name}` : r === 'member' ? `✓ ${x.name}` : x.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={save} disabled={saving} className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-xl">{saving ? 'Zapisywanie...' : '✓ Zapisz'}</button>
                  <button onClick={() => setEditing(null)} className={`flex-1 text-sm font-semibold py-2 rounded-xl ${darkMode ? 'bg-[#3a4155] text-[#e8eaf0]' : 'bg-slate-200 text-slate-600'}`}>Anuluj</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => newPassword(u)} className={`flex-1 text-xs font-semibold py-2 rounded-xl ${darkMode ? 'bg-[#1e2330] text-brand-400 border border-[#3a4155]' : 'bg-brand-50 text-brand-700'}`}>🔑 Nowe hasło</button>
                  <button onClick={() => toggleActive(u)} className={`flex-1 text-xs font-semibold py-2 rounded-xl ${darkMode ? 'bg-[#1e2330] text-[#b0bac8] border border-[#3a4155]' : 'bg-slate-100 text-slate-600'}`}>{u.is_active ? '🚫 Zablokuj' : '✅ Odblokuj'}</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center shrink-0 overflow-hidden border border-brand-200">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} /> : initials(u.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${textMain}`}>{u.name} {!u.is_active && <span className="text-red-400 text-xs">(zablokowany)</span>}</p>
                  <p className={`text-xs ${textMuted}`}><code className={`px-1.5 py-0.5 rounded ${darkMode ? 'bg-[#1e2330] text-[#b0bac8]' : 'bg-slate-100 text-slate-600'}`}>{u.login}</code>{' · '}{u.is_admin ? '👑 Admin' : '🏛️ Radny'}{u.title ? <> · <span className="text-brand-400 font-bold">🎖 {u.title}</span></> : ''}{u.email ? <> · ✉️ {u.email}</> : ''}{u.must_change_password ? ' · musi ustawić hasło' : ''}</p>
                  {(u.memberships || []).filter(m => m.role === 'chair' || m.role === 'vice').map(m => (
                    <p key={m.unit_id} className={`text-xs font-bold ${m.role === 'chair' ? 'text-brand-400' : 'text-sky-400'}`}>
                      {m.role === 'chair' ? '★' : '☆'} {m.role === 'chair' ? 'Przewodniczący' : 'Wice'} · {m.unit_name || m.unit_id}
                    </p>
                  ))}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => setEditing({ ...u })} title="Edytuj" className={`p-2 rounded-lg ${darkMode ? 'text-[#8892a4] hover:text-brand-400 hover:bg-[#2c3344]' : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => del(u.id)} title="Usuń" className={`p-2 rounded-lg ${darkMode ? 'text-[#8892a4] hover:text-red-400 hover:bg-[#3a1a1a]' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className={`text-xs ${textMuted}`}>Przypisanie do komisji i przewodniczących: zakładka „Komisje”.</p>
    </div>
  )
}

// ==================== TAB KOMISJE (przydział — tylko v2) ====================
function TabKomisje({ darkMode, units, users, reload }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('komisja')
  const [icon, setIcon] = useState('gen')
  const [color, setColor] = useState('#5B8DEF')

  const textMain = darkMode ? 'text-[#e8eaf0]' : 'text-slate-900'
  const textMuted = darkMode ? 'text-[#8892a4]' : 'text-slate-500'
  const inputBg = darkMode ? 'bg-[#1e2330] border-[#3a4155] text-[#e8eaf0]' : 'bg-white border-slate-200 text-slate-900'
  const cardBg = darkMode ? 'bg-[#252b38] border-[#3a4155]' : 'bg-white border-slate-100'

  async function addUnit() {
    if (!name.trim()) return
    try {
      await api('/api/admin/units', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), type, icon, color }) })
      setName(''); reload()
    } catch (err) { alert('Błąd: ' + err.message) }
  }

  async function delUnit(id) {
    if (id === 'ogolne') return
    if (!confirm('Usunąć komisję wraz z przypisaniami?')) return
    try { await api('/api/admin/units', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); reload() }
    catch (err) { alert('Błąd: ' + err.message) }
  }

  async function cycle(userId, unitId) {
    try { await api('/api/admin/memberships', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, unit_id: unitId }) }); reload() }
    catch (err) { alert('Błąd: ' + err.message) }
  }

  const roleOf = (u, unitId) => (u.memberships || []).find(m => m.unit_id === unitId)?.role || null
  const ICONS = ['gen', 'eco', 'trans', 'edu', 'stat', 'promo']

  return (
    <div className="p-4 space-y-4">
      <div className={`rounded-2xl border p-4 ${cardBg}`}>
        <p className={`font-semibold text-sm mb-3 ${textMain}`}>Komisje i działy</p>
        <div className="space-y-2 mb-3">
          {units.map(u => {
            const members = users.filter(x => (x.memberships || []).some(m => m.unit_id === u.id))
            const chairs = members.filter(x => (x.memberships || []).some(m => m.unit_id === u.id && m.role === 'chair'))
            const vices = members.filter(x => (x.memberships || []).some(m => m.unit_id === u.id && m.role === 'vice'))
            return (
              <div key={u.id} className="flex items-center gap-3">
                <UnitIcon unit={u} size={36} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${textMain}`}>{u.name}</p>
                  <p className={`text-xs ${textMuted}`}>{u.type === 'dzial' ? 'Dział' : u.type === 'ogolne' ? 'Cały sejmik' : 'Komisja'} · {members.length} osób{chairs.length ? ` · ★ ${chairs.map(c => c.name).join(', ')}` : ''}{vices.length ? ` · ☆ ${vices.map(c => c.name).join(', ')}` : ''}</p>
                </div>
                {u.id !== 'ogolne' && (
                  <button onClick={() => delUnit(u.id)} className={`p-2 rounded-lg ${darkMode ? 'text-[#8892a4] hover:text-red-400' : 'text-slate-400 hover:text-red-500'}`}>🗑</button>
                )}
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nowa komisja…" className={`px-3 py-2 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`} />
          <select value={type} onChange={e => setType(e.target.value)} className={`px-3 py-2 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`}>
            <option value="komisja">Komisja</option>
            <option value="dzial">Dział</option>
          </select>
          <select value={icon} onChange={e => setIcon(e.target.value)} className={`px-3 py-2 border rounded-xl text-sm focus:border-brand-500 focus:outline-none ${inputBg}`}>
            {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer bg-transparent" />
            <button onClick={addUnit} className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl">+ Dodaj</button>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${cardBg}`}>
        <p className={`font-semibold text-sm mb-1 ${textMain}`}>Przydział radnych do komisji</p>
        <p className={`text-xs mb-3 ${textMuted}`}>Kliknij kratkę: ✓ członek · ★ przewodniczący · ☆ wice · 4. klik usuwa</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={`text-left text-xs font-semibold p-2 ${textMuted}`}>Radny</th>
                {units.map(u => (
                  <th key={u.id} className="text-xs font-semibold p-2 text-center min-w-[64px]" style={{ color: colorFor(u) }}>{u.id === 'ogolne' ? 'OGÓLNE (sejmik)' : u.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.filter(u => !u.is_admin).map(u => (
                <tr key={u.id} className={`border-t ${darkMode ? 'border-[#3a4155]' : 'border-slate-100'}`}>
                  <td className={`p-2 font-semibold text-xs ${textMain}`}>{u.name}</td>
                  {units.map(x => {
                    const r = roleOf(u, x.id)
                    return (
                      <td key={x.id} className="p-1 text-center">
                        <button onClick={() => cycle(u.id, x.id)} title={`${u.name} → ${x.name}`}
                          className={`w-9 h-9 rounded-lg text-sm font-bold ${r === 'chair' ? 'bg-brand-500 text-white' : r === 'vice' ? 'bg-sky-600 text-white' : r === 'member' ? 'bg-emerald-600 text-white' : darkMode ? 'bg-[#1e2330] text-[#3a4155] border border-[#3a4155]' : 'bg-slate-100 text-slate-300'}`}>
                          {r === 'chair' ? '★' : r === 'vice' ? '☆' : r === 'member' ? '✓' : '·'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ==================== TAB HISTORIA ====================
function TabHistoria({ darkMode, units }) {
  const [allVotings, setAllVotings] = useState([])
  const [loadingHist, setLoadingHist] = useState(true)
  const [unitFilter, setUnitFilter] = useState('__all')
  const [viewMode, setViewMode] = useState('years')
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedVoting, setSelectedVoting] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [deletingId, setDeletingId] = useState(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function loadHistory() {
    setLoadingHist(true)
    try {
      const lists = await Promise.all(units.map(async u => {
        try {
          const h = await api(`/api/votings/history?unit_id=${u.id}`)
          return (h.votings || []).map(v => ({ ...v, unit_name: u.name, unit_color: colorFor(u) }))
        } catch { return [] }
      }))
      const all = lists.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setAllVotings(all)
    } catch {}
    setLoadingHist(false)
  }

  useEffect(() => { if (units.length) loadHistory() }, [units])

  const filtered = unitFilter === '__all' ? allVotings : allVotings.filter(v => v.unit_id === unitFilter)
  const byYear = {}
  filtered.forEach(v => {
    const y = v.created_at ? new Date(v.created_at).getFullYear() : 'Nieznany'
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(v)
  })
  const years = Object.keys(byYear).sort((a, b) => b - a)
  const typeLabel = (v) => (v.voting_type === 'classic' || !v.voting_type) ? 'Klasyczne' : v.voting_type === 'single_choice' ? 'Pojedynczy wybór' : 'Wielokrotny wybór'

  async function deleteIds(ids) {
    for (const id of ids) {
      await api('/api/admin/votings', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ voting_id: id }) })
    }
  }

  async function handleDelete(v, e) {
    e.stopPropagation()
    if (!confirm(`Usunąć głosowanie wraz z wynikami?\n\n"${v.question}"`)) return
    setDeletingId(v.id)
    try { await deleteIds([v.id]); if (selectedVoting?.id === v.id) setSelectedVoting(null); await loadHistory() }
    catch (err) { alert('Błąd usuwania: ' + err.message) }
    setDeletingId(null)
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    if (!confirm(`Usunąć ${ids.length} głosowań wraz z wynikami?`)) return
    setBulkDeleting(true)
    try { await deleteIds(ids) } catch (err) { alert('Błąd: ' + err.message) }
    setBulkDeleting(false)
    setSelectedIds(new Set()); setSelectMode(false)
    if (selectedVoting && ids.includes(selectedVoting.id)) setSelectedVoting(null)
    await loadHistory()
  }

  function toggleSelected(id) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const cardBg = darkMode ? 'bg-[#252b38] border-[#3a4155]' : 'bg-white border-slate-100'
  const textMain = darkMode ? 'text-[#e8eaf0]' : 'text-slate-900'
  const textMuted = darkMode ? 'text-[#8892a4]' : 'text-slate-500'
  const currentList = viewMode === 'years' && selectedYear ? (byYear[selectedYear] || []) : filtered

  function VotingRow({ v }) {
    const checked = selectedIds.has(v.id)
    return (
      <div onClick={() => { if (!selectMode) setSelectedVoting(v) }}
        className={`w-full text-left rounded-xl border p-4 cursor-pointer flex items-start gap-3 ${cardBg} ${checked ? 'ring-2 ring-brand-400' : ''}`}>
        {selectMode && (
          <button onClick={() => toggleSelected(v.id)} className="pt-0.5 shrink-0">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${checked ? 'border-brand-500 bg-brand-500' : darkMode ? 'border-[#3a4155]' : 'border-slate-300'}`}>
              {checked && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${darkMode ? 'bg-[#1e2330] text-[#8892a4]' : 'bg-slate-100 text-slate-500'}`}>🟢 Zakończone</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${v.is_secret ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'}`}>{v.is_secret ? '🔒 Tajne' : 'Jawne'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${darkMode ? 'bg-[#1e2330] text-[#8892a4]' : 'bg-slate-100 text-slate-500'}`}>{typeLabel(v)}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: (v.unit_color || '#888') + '22', color: v.unit_color || '#888' }}>{v.unit_name}</span>
          </div>
          <p className={`font-semibold text-sm leading-snug break-words ${textMain}`}>{v.question}</p>
          <p className={`text-xs mt-1 ${textMuted}`}>{v.created_at ? new Date(v.created_at).toLocaleString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'} · frekwencja {v.voted_count}/{v.eligible_count}</p>
        </div>
        {!selectMode && (
          <button onClick={(e) => handleDelete(v, e)} disabled={deletingId === v.id} title="Usuń głosowanie"
            className={`shrink-0 p-2 rounded-lg disabled:opacity-40 ${darkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'}`}>
            {deletingId === v.id ? <span className="text-xs">…</span> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-1 13a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7h14z" /></svg>
            )}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className={`font-bold text-base ${textMain}`}>Historia głosowań</h2>
        {filtered.length > 0 && (viewMode !== 'years' || selectedYear) && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()) }}
              className={`px-4 py-2 rounded-xl text-xs font-semibold ${selectMode ? 'bg-emerald-600 text-white' : darkMode ? 'bg-[#252b38] border border-[#3a4155] text-[#e8eaf0]' : 'bg-slate-100 text-slate-700'}`}>
              {selectMode ? '✕ Anuluj zaznaczanie' : '☑ Zaznacz do usunięcia'}
            </button>
            {selectMode && (
              <button onClick={handleBulkDelete} disabled={selectedIds.size === 0 || bulkDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold">
                {bulkDeleting ? 'Usuwanie…' : `🗑️ Usuń (${selectedIds.size})`}
              </button>
            )}
          </div>
        )}
      </div>
      <UnitPicker units={units} value={unitFilter} onChange={(v) => { setUnitFilter(v); setSelectedYear(null) }} darkMode={darkMode} allowAll />

      {loadingHist ? (
        <p className={`text-sm text-center py-8 ${textMuted}`}>Ładowanie…</p>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-12 ${textMuted}`}>
          <div className="text-4xl mb-3">📭</div>
          <p className="font-semibold">Brak zakończonych głosowań</p>
        </div>
      ) : viewMode === 'years' && !selectedYear ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)} className={`rounded-2xl border p-6 text-center hover:scale-105 ${cardBg}`}>
              <div className={`text-3xl font-extrabold ${textMain}`}>{y}</div>
              <div className={`text-xs mt-1 ${textMuted}`}>{byYear[y].length} głosowań</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {viewMode === 'years' && selectedYear && (
            <button onClick={() => setSelectedYear(null)} className={`text-xs font-semibold ${textMuted}`}>← Wróć do lat</button>
          )}
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {currentList.map(v => <VotingRow key={v.id} v={v} />)}
          </div>
        </div>
      )}

      {selectedVoting && <VotingModal voting={selectedVoting} onClose={() => setSelectedVoting(null)} darkMode={darkMode} />}
    </div>
  )
}

// Modal ze szczegółami głosowania (dane z API v2 — wyniki już w środku)
function VotingModal({ voting, onClose, darkMode }) {
  const v = voting
  const isClassic = v.voting_type === 'classic' || !v.voting_type
  const secret = !!v.is_secret
  const rows = !secret && Array.isArray(v.results) ? v.results : []
  const counts = secret && v.results && v.results.counts ? v.results.counts : null
  const zaCount = secret ? (counts?.find(c => c.label === 'ZA')?.n || 0) : rows.filter(x => x.choice === 'ZA').length
  const wstrzCount = secret ? (counts?.find(c => c.label === 'WSTRZ')?.n || 0) : rows.filter(x => x.choice === 'WSTRZ').length
  const przeciwCount = secret ? (counts?.find(c => c.label === 'PRZECIW')?.n || 0) : rows.filter(x => x.choice === 'PRZECIW').length
  const total = zaCount + wstrzCount + przeciwCount
  const pct = (n) => total > 0 ? Math.round(n / total * 100) : 0
  const namesFor = (c) => rows.filter(x => x.choice === c).map(x => x.name || 'Nieznany')
  const opts = Array.isArray(v.options) ? v.options : []
  const oCounts = {}
  opts.forEach(o => { oCounts[o] = 0 })
  rows.forEach(x => {
    if (x.choices && Array.isArray(x.choices)) x.choices.forEach(c => { if (oCounts[c] !== undefined) oCounts[c]++ })
    else if (x.choice && oCounts[x.choice] !== undefined) oCounts[x.choice]++
  })
  if (secret && counts) counts.forEach(c => { if (oCounts[c.label] !== undefined) oCounts[c.label] = c.n })
  const oTotal = Object.values(oCounts).reduce((a, b) => a + b, 0)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-600 to-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-sm">ZAKOŃCZONE</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white">{secret ? '🔒 Tajne' : 'Jawne'}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white ml-1">{isClassic ? 'Klasyczne' : v.voting_type === 'single_choice' ? 'Pojedynczy' : 'Personalne'}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1 text-xl">✕</button>
        </div>
        <div className="p-5 overflow-y-auto">
          <p className="font-bold text-slate-900 text-base mb-1 leading-snug break-words">{v.question}</p>
          <p className="text-xs text-slate-500 mb-4">{v.unit_name || ''} · {v.created_at ? new Date(v.created_at).toLocaleString('pl-PL') : ''} · frekwencja {v.voted_count}/{v.eligible_count}</p>
          {isClassic ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[['ZA', zaCount, 'bg-green-50 border-green-200 text-green-700'], ['WSTRZ.', wstrzCount, 'bg-slate-50 border-slate-200 text-slate-600'], ['PRZECIW', przeciwCount, 'bg-red-50 border-red-200 text-red-700']].map(([label, val, cls]) => (
                  <div key={label} className={`${cls.split(' ')[0]} border-2 ${cls.split(' ')[1]} rounded-2xl p-4 text-center`}>
                    <div className={`text-4xl font-extrabold ${cls.split(' ')[2]} leading-none`}>{val}</div>
                    <div className="text-xs font-bold mt-1.5 uppercase tracking-wide text-slate-500">{label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{pct(val)}%</div>
                  </div>
                ))}
              </div>
              {total > 0 && (
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex mb-3">
                  <div className="bg-green-500" style={{ width: `${pct(zaCount)}%` }} />
                  <div className="bg-slate-400" style={{ width: `${pct(wstrzCount)}%` }} />
                  <div className="bg-red-500" style={{ width: `${pct(przeciwCount)}%` }} />
                </div>
              )}
              <p className="text-xs text-slate-500 text-center">Łącznie głosów: <strong>{total}</strong></p>
              {!secret && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <div className="grid grid-cols-1 gap-2">
                    {['ZA', 'WSTRZ', 'PRZECIW'].map(c => (
                      <div key={c}><p className="text-xs font-bold text-slate-500">{c}: {namesFor(c).join(', ') || 'Brak'}</p></div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {opts.map((opt, idx) => {
                const count = oCounts[opt] || 0
                const op = oTotal > 0 ? Math.round((count / oTotal) * 100) : 0
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-24 text-right text-xs font-bold uppercase text-slate-600 shrink-0">{opt}</div>
                    <div className="flex-1 h-7 bg-slate-100 rounded overflow-hidden relative">
                      <div className="h-full bg-brand-500 rounded flex items-center justify-end px-2 text-white font-bold text-xs" style={{ width: `${Math.max(op, 2)}%`, minWidth: count > 0 ? '1.5rem' : '0' }}>{count > 0 && count}</div>
                    </div>
                    <div className="w-8 text-right font-bold text-sm text-slate-900">{count}</div>
                    <div className="w-12 text-right text-xs text-slate-500">({op}%)</div>
                  </div>
                )
              })}
              <p className="text-xs text-slate-500 text-center pt-2">Łącznie głosów: <strong>{oTotal}</strong></p>
            </div>
          )}
          {secret && total > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4 text-center">
              <p className="text-xs text-purple-500 italic">🔒 Głosowanie tajne — nazwiska są ukryte</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== TAB USTAWIENIA ====================
function TabUstawienia({ darkMode, setDarkMode, officialMode, setOfficialMode }) {
  const [saveAnimation, setSaveAnimation] = useState(false)

  const handleSave = () => {
    localStorage.setItem('dsm_dark_mode', JSON.stringify(darkMode))
    localStorage.setItem('dsm_official_mode', JSON.stringify(officialMode))
    setSaveAnimation(true)
    setTimeout(() => setSaveAnimation(false), 1500)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className={`rounded-2xl border shadow-sm p-6 space-y-6 ${darkMode ? 'bg-[#252b38] border-[#3a4155]' : 'bg-white border-slate-100'}`}>
        <h2 className={`text-lg font-bold ${darkMode ? 'text-[#e8eaf0]' : 'text-slate-800'}`}>Ustawienia wyświetlania</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className={`font-semibold text-sm ${darkMode ? 'text-[#e8eaf0]' : 'text-slate-800'}`}>Tryb Oficjalny</p>
            <p className={`text-xs ${darkMode ? 'text-[#8892a4]' : 'text-slate-500'}`}>Włącza oficjalny wygląd ekranu wyników z herbem i statystykami</p>
          </div>
          <button type="button" onClick={() => setOfficialMode(!officialMode)} className={`w-12 h-7 rounded-full relative ${officialMode ? 'bg-emerald-600' : darkMode ? 'bg-[#3a4155]' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 block w-5 h-5 bg-white rounded-full shadow-md ${officialMode ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className={`font-semibold text-sm ${darkMode ? 'text-[#e8eaf0]' : 'text-slate-800'}`}>Motyw Ciemny</p>
            <p className={`text-xs ${darkMode ? 'text-[#8892a4]' : 'text-slate-500'}`}>Włącza ciemny motyw w całej aplikacji</p>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className={`w-12 h-7 rounded-full relative ${darkMode ? 'bg-[#4f8ef7]' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 block w-5 h-5 bg-white rounded-full shadow ${darkMode ? 'left-6' : 'left-1'}`} />
          </button>
        </div>

        <div className={`rounded-xl p-4 text-xs border ${darkMode ? 'bg-[#1e2330] text-[#8892a4] border-[#3a4155]' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
          <p className="font-semibold mb-1">Podpowiedź:</p>
          <p>Wyłącz tryb oficjalny w celu powrotu do standardowego wyglądu panelu administratora.</p>
        </div>

        <button onClick={handleSave} className={`w-full font-bold py-3 rounded-xl shadow-lg text-white ${saveAnimation ? 'bg-green-500' : 'bg-brand-600 hover:bg-brand-700'}`}>
          {saveAnimation ? '✓ Zapisano!' : '💾 Zapisz ustawienia'}
        </button>
      </div>
    </div>
  )
}

// ==================== STRONA GŁÓWNA ADMINA ====================
export default function AdminPage() {
  const router = useRouter()
  const [me, setMe] = useState(null)
  const [tab, setTab] = useState('wyniki')
  const [darkMode, setDarkMode] = useState(true)
  const [officialMode, setOfficialMode] = useState(false)
  const [units, setUnits] = useState([])
  const [users, setUsers] = useState([])
  const [reloadKey, setReloadKey] = useState(0)

  async function loadAll() {
    try {
      const [u, us] = await Promise.all([
        api('/api/admin/units').catch(() => ({ units: [] })),
        api('/api/admin/users').catch(() => ({ users: [] })),
      ])
      setUnits(u.units || []); setUsers(us.users || [])
    } catch {}
  }

  useEffect(() => {
    api('/api/auth/me').then(j => {
      if (!j.user || !j.user.is_admin) { router.push(j.user ? '/glosowanie' : '/'); return }
      setMe(j.user)
      loadAll()
      try {
        const sd = localStorage.getItem('dsm_dark_mode')
        const so = localStorage.getItem('dsm_official_mode')
        if (sd !== null) setDarkMode(JSON.parse(sd)); else setDarkMode(true)
        if (so !== null) setOfficialMode(JSON.parse(so))
      } catch {}
      const onStorage = (e) => {
        try {
          if (e.key === 'dsm_dark_mode') setDarkMode(JSON.parse(e.newValue || 'true'))
          if (e.key === 'dsm_official_mode') setOfficialMode(JSON.parse(e.newValue || 'false'))
        } catch {}
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    }).catch(() => router.push('/'))
  }, [])

  useEffect(() => { if (me) loadAll() }, [reloadKey])
  const reload = () => setReloadKey(k => k + 1)

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    try { localStorage.setItem('dsm_dark_mode', JSON.stringify(next)) } catch {}
  }

  function toggleOfficial() {
    const next = !officialMode
    setOfficialMode(next)
    try { localStorage.setItem('dsm_official_mode', JSON.stringify(next)) } catch {}
  }

  const tabs = [
    { id: 'wyniki', label: 'Wyniki', icon: '📊' },
    { id: 'glosowania', label: 'Głosowania', icon: '🗳️' },
    { id: 'uzytkownicy', label: 'Użytkownicy', icon: '👥' },
    { id: 'komisje', label: 'Komisje', icon: '🏛️' },
    { id: 'historia', label: 'Historia', icon: '📜' },
    { id: 'ustawienia', label: 'Ustawienia', icon: '⚙️' },
  ]

  const bgStyle = darkMode
    ? {
        backgroundImage: 'url(/tloappdsm.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#1a1e27'
      }
    : { backgroundColor: '#f8fafc' }

  if (!me) return <div className="min-h-screen flex items-center justify-center text-slate-500" style={bgStyle}><p className="animate-pulse">Ładowanie…</p></div>

  return (
    <>
      <Head><title>Panel Administratora – DSM</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
      <div className="min-h-screen" style={bgStyle}>
        <header className={`border-b ${darkMode ? 'bg-[#1e2330] border-[#3a4155]' : 'bg-white border-slate-200'}`}>
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img src={LOGO} alt="DSM" className="h-9 w-9 object-contain rounded-lg shrink-0" onError={e => { e.target.src = '/icons/system-glosowania.jpg' }} />
              <div className="leading-tight min-w-0">
                <h1 className={`font-bold text-[15px] truncate ${darkMode ? 'text-[#e8eaf0]' : 'text-slate-900'}`}>Panel Administratora - DSM</h1>
              </div>
            </div>
            <button onClick={logout} className={`flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md shrink-0 ${darkMode ? 'text-[#b0bac8] hover:text-white hover:bg-[#2c3344]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 4-4m0 0l-4-4m4 4H9" />
              </svg>
              <span className="hidden sm:inline">Wyloguj</span>
            </button>
          </div>

          <div className={`max-w-3xl mx-auto px-2 flex border-t overflow-x-auto ${darkMode ? 'border-[#3a4155]' : 'border-slate-200'}`}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 md:px-5 py-3.5 text-sm font-semibold border-b-[3px] whitespace-nowrap ${tab === t.id ? (darkMode ? 'bg-[#252b38] text-[#e8eaf0] border-[#4f8ef7]' : 'bg-slate-50 text-slate-900 border-brand-500') : (darkMode ? 'text-[#8892a4] border-transparent hover:text-[#e8eaf0]' : 'text-slate-500 border-transparent hover:text-slate-900')}`}>
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="max-w-3xl mx-auto">
          {tab === 'wyniki' && <TabWyniki darkMode={darkMode} officialMode={officialMode} units={units} />}
          {tab === 'glosowania' && <TabGlosowania darkMode={darkMode} units={units} />}
          {tab === 'uzytkownicy' && <TabUzytkownicy darkMode={darkMode} units={units} onChanged={reload} />}
          {tab === 'komisje' && <TabKomisje darkMode={darkMode} units={units} users={users} reload={reload} />}
          {tab === 'historia' && <TabHistoria darkMode={darkMode} units={units} />}
          {tab === 'ustawienia' && <TabUstawienia darkMode={darkMode} setDarkMode={toggleDark} officialMode={officialMode} setOfficialMode={toggleOfficial} />}
        </div>
      </div>

      <style jsx global>{`
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #3a4155; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #4f8ef7; }
      `}</style>
    </>
  )
}
