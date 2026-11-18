import { useState } from 'react'
import { useAuth } from './auth'
import { configured } from './firebase'
import { Apps } from './components/Apps'
import { Editors } from './components/Editors'
import { Labels } from './components/Labels'
import { Lexicon } from './components/Lexicon'
import { useT } from './ui/i18n'
import type { UiKey } from './ui/text'

type View = 'labels' | 'apps' | 'lexicon' | 'editors'

export default function App() {
  const { ready, user, email, editor, admin, error, signIn, signOut } = useAuth()
  const t = useT()
  const [view, setView] = useState<View>('labels')
  const tabs: [View, UiKey][] = [['labels', 'nav.labels'], ['apps', 'nav.apps'], ['lexicon', 'nav.lexicon'], ...(admin ? [['editors', 'nav.editors'] as [View, UiKey]] : [])]
  const Email = <bdi dir="ltr">{email}</bdi>

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true">ބަސް</span>
          <div>
            <h1>{t('app.title')}</h1>
            <p className="tag">{t('app.tagline')}</p>
          </div>
        </div>
        {user && <div className="who">{Email}<button type="button" className="quiet" onClick={signOut}>{t('auth.signOut')}</button></div>}
      </header>

      {!configured ? (
        <main className="gate"><h2>{t('gate.notSetUp.title')}</h2><p>{t.rich('gate.notSetUp.body', { file: <code>.env.local</code>, doc: <code>docs/SETUP.md</code> })}</p></main>
      ) : !ready ? (
        <main className="gate"><p>{t('gate.loading')}</p></main>
      ) : !user ? (
        <main className="gate">
          <h2>{t('gate.welcome.title')}</h2>
          <p>{t('gate.welcome.body')}</p>
          <button type="button" className="primary" onClick={signIn}>{t('auth.signIn')}</button>
          {error && <p className="problem" role="alert">{t('auth.error')}</p>}
        </main>
      ) : !editor ? (
        <main className="gate"><h2>{t('gate.notEditor.title')}</h2><p>{t.rich('gate.notEditor.body', { email: Email })}</p></main>
      ) : (
        <>
          <nav className="tabs" aria-label={t('nav.aria')}>
            {tabs.map(([id, label]) => <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{t(label)}</button>)}
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
