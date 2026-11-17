import { useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { APP_KINDS, emptyApp, emptyString, exportFixes, parseImport, validateApp, type AppData, type StringData } from '../core/strings'
import { importApp, publishedUrl, republish, saveApp, useApps, type App, type ImportResult } from '../strings'


export function Apps({ admin }: { admin: boolean }) {
  const apps = useApps()
  const [adding, setAdding] = useState(false)
  return (
    <section className="apps">
      <div className="section-head">
        <h2>Connected apps</h2>
        <button type="button" className="primary" onClick={() => setAdding(!adding)}>{adding ? 'Close' : 'Add an app'}</button>
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
  const [id, setId] = useState(prev?.id ?? '')
  const [d, setD] = useState<AppData>(prev ?? emptyApp())
  const [err, setErr] = useState('')
  const e = validateApp(id, d)
  const set = <K extends keyof AppData>(k: K, v: AppData[K]) => setD({ ...d, [k]: v })
  return (
    <form className="card form" onSubmit={async (ev) => {
      ev.preventDefault()
      try { await saveApp(id, d, prev); onDone() } catch { setErr('Not saved. Only editors can add apps; check the fields.') }
    }}>
      <div className="grid2">
        <label className="field"><span>Id (lower case, used by the app)</span><input id="app-id" value={id} disabled={!!prev} onChange={(x) => setId(x.target.value.trim())} placeholder="fc-eforms" aria-invalid={!!e.id && !!id} /></label>
        <label className="field"><span>Name</span><input id="app-name" value={d.name} onChange={(x) => set('name', x.target.value)} placeholder="Family Court eForms" /></label>
        <label className="field"><span>Kind</span><select id="app-kind" value={d.kind} onChange={(x) => set('kind', x.target.value as AppData['kind'])}>{APP_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="field"><span>Labels are found by</span><select id="app-keys" value={d.keyStyle} onChange={(x) => set('keyStyle', x.target.value as AppData['keyStyle'])}><option value="keys">keys (errors.taken)</option><option value="text">their Dhivehi text (written in the code)</option></select></label>
        <label className="field"><span>Repository</span><input id="app-repo" value={d.repo} onChange={(x) => set('repo', x.target.value)} placeholder="kudadonbe/TaxiQ" /></label>
        <label className="field"><span>Description</span><input id="app-desc" value={d.description} onChange={(x) => set('description', x.target.value)} /></label>
      </div>
      {e.id && id && <p className="problem">The id is 2 to 40 lower-case letters, digits or hyphens.</p>}
      {err && <p className="problem" role="alert">{err}</p>}
      <div className="actions"><button type="submit" className="primary" disabled={Object.keys(e).length > 0}>Save app</button></div>
    </form>
  )
}

function Importer() {
  const [problems, setProblems] = useState<string[]>([])
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<(ImportResult & { app: string }) | null>(null)
  return (
    <div className="card importer">
      <h3>Import an app's strings</h3>
      <p className="hint">A JSON file in the format of <code>docs/API.md</code> ("Import format"), made by the app's own export script. Corrections already made are kept; a string the app dropped is set aside, not deleted.</p>
      <input id="import-file" type="file" accept="application/json,.json" disabled={!!busy} onChange={async (ev) => {
        const f = ev.target.files?.[0]
        ev.target.value = ''
        if (!f) return
        setProblems([]); setResult(null)
        let raw: unknown
        try { raw = JSON.parse(await f.text()) } catch { setProblems(['This file is not JSON.']); return }
        const { file, problems } = parseImport(raw)
        if (!file) { setProblems(problems.slice(0, 12)); return }
        setBusy({ done: 0, total: file.strings.length })
        try {
          const r = await importApp(file, (done, total) => setBusy({ done, total }))
          setResult({ ...r, app: file.app })
        } catch {
          setProblems(['The import stopped part way. Run it again with the same file: it carries on where it stopped.'])
        } finally { setBusy(null) }
      }} />
      {busy && <p className="status">Saving {busy.done} of {busy.total}…</p>}
      {problems.length > 0 && <ul className="problem">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
      {result && (
        <p className="status">
          {result.app}: {result.created} new, {result.updated} changed, {result.unchanged} unchanged
          {result.landed.length ? `, ${result.landed.length} corrections now in the app's code` : ''}
          {result.reopened.length ? `, ${result.reopened.length} back to review (the app changed them)` : ''}
          {result.retire.length ? `, ${result.retire.length} no longer in the app` : ''}.
        </p>
      )}
    </div>
  )
}

function AppCard({ a, admin }: { a: App; admin: boolean }) {
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
        <h3>{a.name} <code>{a.id}</code></h3>
        <span className="pill">{a.kind}{a.keyStyle === 'text' ? ' · by text' : ''}</span>
      </div>
      {a.description && <p>{a.description}</p>}
      {a.repo && <p className="hint">Code: {a.repo}</p>}
      <p className="hint">Corrections for this app, public and read-only: <code className="url">{publishedUrl(a.id)}</code></p>
      <div className="actions">
        <button type="button" onClick={exportIt}>Download corrections (to write into the code)</button>
        <button type="button" onClick={() => setEditing(!editing)}>{editing ? 'Close' : 'Edit'}</button>
        {admin && <button type="button" className="quiet" onClick={async () => { try { await republish(a.id); setMsg('Published again from the strings.') } catch { setMsg('Not done.') } }}>Republish</button>}
      </div>
      {msg && <p className="status">{msg}</p>}
      {editing && <AppForm prev={a} onDone={() => setEditing(false)} />}
    </li>
  )
}
