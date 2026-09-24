import Head from 'next/head'

export default function Rodo() {
  return (
    <>
      <Head><title>RODO – System głosowania DSM</title></Head>
      <div className="min-h-screen bg-white p-6 max-w-2xl mx-auto text-sm space-y-3">
        <h1 className="text-xl font-bold">Informacja o przetwarzaniu danych (RODO)</h1>
        <p><b>Administrator:</b> Dolnośląski Sejmik Młodzieży (uzupełnij dane kontaktowe).</p>
        <p><b>Cel:</b> przeprowadzanie głosowań komisji, działów i ogółu sejmiku, w tym liczenie frekwencji i wyników.</p>
        <p><b>Zakres:</b> imię i nazwisko, login, hash hasła, przynależność do komisji, fakt oddania głosu. W głosowaniach jawnych także treść głosu; w tajnych treść głosu jest odseparowana od tożsamości (bez znacznika czasu).</p>
        <p><b>Podstawa:</b> art. 6 ust. 1 lit. e RODO (zadanie realizowane w interesie publicznym) / regulamin sejmiku.</p>
        <p><b>Przechowywanie:</b> dane na serwerze Administratora (terminal / VPS w UE). Kopie zapasowe szyfrowane.</p>
        <p><b>Prawa:</b> dostęp, sprostowanie, ograniczenie, sprzeciw — kontakt z administratorem systemu.</p>
        <p><a href="/" className="underline">← Wróć do logowania</a></p>
      </div>
    </>
  )
}
