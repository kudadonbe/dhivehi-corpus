import { useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { APP_KINDS, emptyApp, emptyString, exportFixes, parseImport, validateApp, type AppData, type StringData } from '../core/strings'
import { importApp, publishedUrl, republish, saveApp, useApps, type App, type ImportResult } from '../strings'
import { useT } from '../ui/i18n'
import { optionKey } from '../ui/text'

export function Apps({ admin }: { admin: boolean }) {
  const t = useT()
  const apps = useApps()
  const [adding, setAdding] = useState(false)
  return (
    <section className="apps">
      <div className="section-head">
        <h2>{t('apps.title')}</h2>
        <button type="button" className="primary" onClick={() => setAdding(!adding)}>{t(adding ? 'common.close' : 'apps.add')}</button>
      </div>
      {adding && <AppForm prev={null} onDone={() => setAdding(false)} />}
      <Importer />
      <ul className="app-list">
        {apps.map((a) => <AppCard key={a.id} a={a} admin={admin} />)}
      </ul>
    </section>
  )
}

function AppForm({ prev, onDone }: { prev: App | null; onDone: () => void }) {
  const t = useT()
  const [id, setId] = useState(prev?.id ?? '')
  const [d, setD] = useState<AppData>(prev ?? emptyApp())
  const [err, setErr] = useState('')
  const e = validateApp(id, d)
  const set = <K extends keyof AppData>(k: K, v: AppData[K]) => setD({ ...d, [k]: v })
  return (
    <form className="card form" onSubmit={async (ev) => {
      ev.preventDefault()
      try { await saveApp(id, d, prev); onDone() } catch { setErr(t('apps.saveFailed')) }
    }}>
      <div className="grid2">
        <label className="field"><span>{t('apps.id')}</span><input id="app-id" dir="ltr" value={id} disabled={!!prev} onChange={(x) => setId(x.target.value.trim())} placeholder="fc-eforms" aria-invalid={!!e.id && !!id} /></label>
        <label className="field"><span>{t('common.name')}</span><input id="app-name" dir="auto" value={d.name} onChange={(x) => set('name', x.target.value)} placeholder="Family Court eForms" /></label>
        <label className="field"><span>{t('apps.kind')}</span><select id="app-kind" value={d.kind} onChange={(x) => set('kind', x.target.value as AppData['kind'])}>{APP_KINDS.map((k) => <option key={k} value={k}>{t(optionKey('kind', k))}</option>)}</select></label>
        <label className="field"><span>{t('apps.keyStyle')}</span><select id="app-keys" value={d.keyStyle} onChange={(x) => set('keyStyle', x.target.value as AppData['keyStyle'])}><option value="keys">{t('apps.byKeys')}</option><option value="text">{t('apps.byText')}</option></select></label>
        <label className="field"><span>{t('apps.repo')}</span><input id="app-repo" dir="ltr" value={d.repo} onChange={(x) => set('repo', x.target.value)} placeholder="kudadonbe/TaxiQ" /></label>
        <label className="field"><span>{t('apps.desc')}</span><input id="app-desc" dir="auto" value={d.description} onChange={(x) => set('description', x.target.value)} /></label>
      </div>
      {e.id && id && <p className="problem">{t('apps.idRule')}</p>}
      {err && <p className="problem" role="alert">{err}</p>}
      <div className="actions"><button type="submit" className="primary" disabled={Object.keys(e).length > 0}>{t('apps.save')}</button></div>
    </form>
  )
}

function Importer() {
  const t = useT()
  const [problems, setProblems] = useState<string[]>([])
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<(ImportResult & { app: string }) | null>(null)
  return (
    <div className="card importer">
      <h3>{t('import.title')}</h3>
      <p className="hint">{t.rich('import.hint', { doc: <code>docs/API.md</code> })}</p>
      <input id="import-file" type="file" accept="application/json,.json" disabled={!!busy} onChange={async (ev) => {
        const f = ev.target.files?.[0]
        ev.target.value = ''
        if (!f) return
        setProblems([]); setResult(null)
        let raw: unknown
        try { raw = JSON.parse(await f.text()) } catch { setProblems([t('import.notJson')]); return }
        const { file, problems } = parseImport(raw)
        if (!file) { setProblems(problems.slice(0, 12)); return }
        setBusy({ done: 0, total: file.strings.length })
        try {
          const r = await importApp(file, (done, total) => setBusy({ done, total }))
          setResult({ ...r, app: file.app })
        } catch {
          setProblems([t('import.stopped')])
        } finally { setBusy(null) }
      }} />
      {busy && <p className="status">{t('import.saving', busy)}</p>}
      {problems.length > 0 && <ul className="problem">{problems.map((p) => <li key={p} dir="auto">{p}</li>)}</ul>}
      {result && (
        <p className="status">
          {t.rich('import.result', { app: <bdi dir="ltr">{result.app}</bdi>, created: result.created, updated: result.updated, unchanged: result.unchanged })}
          {result.landed.length ? t('import.landed', { n: result.landed.length }) : ''}
          {result.reopened.length ? t('import.reopened', { n: result.reopened.length }) : ''}
          {result.retire.length ? t('import.retired', { n: result.retire.length }) : ''}.
        </p>
      )}
    </div>
  )
}

function AppCard({ a, admin }: { a: App; admin: boolean }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [msg, setMsg] = useState('')
  const exportIt = async () => {
    const list = (await getDocs(query(collection(db, 'strings'), where('app', '==', a.id)))).docs.map((d) => ({ ...emptyString(a.id, ''), ...d.data() }) as StringData)
    const body = JSON.stringify({ format: 'dhivehi-corpus/fixes-1', app: a.id, exportedAt: new Date().toISOString(), fixes: exportFixes(list) }, null, 2)
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `${a.id}-corrections.json` })
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <li className="card app">
      <div className="section-head">
        <h3><bdi dir="auto">{a.name}</bdi> <code dir="ltr">{a.id}</code></h3>
        <span className="pill">{t(optionKey('kind', a.kind))}{a.keyStyle === 'text' ? ` · ${t('apps.byTextPill')}` : ''}</span>
      </div>
      {a.description && <p dir="auto">{a.description}</p>}
      {a.repo && <p className="hint">{t.rich('apps.code', { repo: <bdi dir="ltr">{a.repo}</bdi> })}</p>}
      <p className="hint">{t.rich('apps.published', { url: <code className="url" dir="ltr">{publishedUrl(a.id)}</code> })}</p>
      <div className="actions">
        <button type="button" onClick={exportIt}>{t('apps.download')}</button>
        <button type="button" onClick={() => setEditing(!editing)}>{t(editing ? 'common.close' : 'common.edit')}</button>
        {admin && <button type="button" className="quiet" onClick={async () => { try { await republish(a.id); setMsg(t('apps.republished')) } catch { setMsg(t('common.notDone')) } }}>{t('apps.republish')}</button>}
      </div>
      {msg && <p className="status">{msg}</p>}
      {editing && <AppForm prev={a} onDone={() => setEditing(false)} />}
    </li>
  )
}
