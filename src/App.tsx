import { useState } from 'react'
import { useAuth } from './auth'
import { configured } from './firebase'
import { Apps } from './components/Apps'
import { Editors } from './components/Editors'
import { Labels } from './components/Labels'
import { Lexicon } from './components/Lexicon'

type View = 'labels' | 'apps' | 'lexicon' | 'editors'

export default function App() {
  const { ready, user, email, editor, admin, error, signIn, signOut } = useAuth()
  const [view, setView] = useState<View>('labels')
  const tabs: [View, string][] = [['labels', 'App labels'], ['apps', 'Apps'], ['lexicon', 'Lexicon'], ...(admin ? [['editors', 'Editors'] as [View, string]] : [])]

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="mark" lang="dv" aria-hidden="true">ބަސް</span>
          <div>
            <h1>Dhivehi corpus</h1>
            <p className="tag" lang="dv" dir="rtl">ދިވެހި ބަހުގެ ކޯޕަސް</p>
          </div>
        </div>
        {user && <div className="who"><span>{email}</span><button type="button" className="quiet" onClick={signOut}>Sign out</button></div>}
      </header>

      {!configured ? (
        <main className="gate"><h2>Not set up yet</h2><p>This copy has no Firebase project. Put the corpus project's web config in <code>.env.local</code> (see <code>docs/SETUP.md</code>).</p></main>
      ) : !ready ? (
        <main className="gate"><p>Loading…</p></main>
      ) : !user ? (
        <main className="gate">
          <h2>One place for every app's Dhivehi</h2>
          <p>The words of the language, and every label the court's apps and TaxiQ show. A correction made here reaches each app at once.</p>
          <button type="button" className="primary" onClick={signIn}>Sign in with Google</button>
          {error && <p className="problem" role="alert">{error}</p>}
        </main>
      ) : !editor ? (
        <main className="gate"><h2>Not an editor yet</h2><p>{email} is not on the list of editors. Ask an admin to add this address, then reload.</p></main>
      ) : (
        <>
          <nav className="tabs" aria-label="Corpus">
            {tabs.map(([id, label]) => <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>)}
          </nav>
          <main>
            {view === 'labels' && <Labels />}
            {view === 'apps' && <Apps admin={admin} />}
            {view === 'lexicon' && <Lexicon />}
            {view === 'editors' && admin && <Editors me={email} />}
          </main>
        </>
      )}
    </div>
  )
}
