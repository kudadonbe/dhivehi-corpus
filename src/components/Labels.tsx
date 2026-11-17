import { useMemo, useState } from 'react'
import { checkFix, current, progress, stringMatches, type FixProblem, type Status } from '../core/strings'
import { review, useApps, useStrings, type Str } from '../strings'
import { toThaana } from '../thaana'

const PROBLEM: Record<FixProblem, string> = {
  empty: 'Write the correction first.',
  too_long: 'Too long: 4,000 characters at most.',
  not_thaana: 'The correction must be in Dhivehi (Thaana letters).',
  placeholders: 'Keep every placeholder exactly as in the original, e.g. {code} or %s: the app fills them in.',
  same: 'This is the same as the original. Use "Correct as it is" instead.',
}
const FILTERS: { id: 'todo' | Status | 'all'; label: string }[] = [
  { id: 'todo', label: 'To review' },
  { id: 'fixed', label: 'Corrected' },
  { id: 'checked', label: 'Correct as is' },
  { id: 'all', label: 'All' },
]
const PAGE = 40

export function Labels() {
  const apps = useApps()
  const [appId, setAppId] = useState<string | null>(null)
  const app = appId ?? apps[0]?.id ?? null
  const { list, loading } = useStrings(app)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('todo')
  const [group, setGroup] = useState('')
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)

  const live = useMemo(() => list.filter((s) => !s.retired), [list])
  const groups = useMemo(() => [...new Set(live.map((s) => s.group).filter(Boolean))].sort(), [live])
  const rows = useMemo(
    () => live
      .filter((s) => (filter === 'all' ? true : filter === 'todo' ? s.status === 'new' : s.status === filter))
      .filter((s) => !group || s.group === group)
      .filter((s) => stringMatches(q, s))
      .sort((a, b) => a.group.localeCompare(b.group) || (a.where[0] ?? '').localeCompare(b.where[0] ?? '', undefined, { numeric: true })),
    [live, filter, group, q],
  )
  const p = progress(list)
  const reset = () => setShown(PAGE)

  if (!apps.length) return <p className="empty">No app is connected yet. Add one under <strong>Apps</strong> and import its strings.</p>

  return (
    <section className="labels">
      <div className="toolbar">
        <label className="field">
          <span>App</span>
          <select id="app" value={app ?? ''} onChange={(e) => { setAppId(e.target.value); setGroup(''); reset() }}>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Part</span>
          <select id="group" value={group} onChange={(e) => { setGroup(e.target.value); reset() }}>
            <option value="">Every part</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="field grow">
          <span>Search</span>
          <input id="search" type="search" value={q} placeholder="Dhivehi, English, file or key" onChange={(e) => { setQ(e.target.value); reset() }} />
        </label>
      </div>

      <div className="progress" aria-label="Review progress">
        <div className="bar" role="img" aria-label={`${p.checked + p.fixed} of ${p.total} reviewed`}>
          <span className="seg fixed" style={{ width: `${p.total ? (p.fixed / p.total) * 100 : 0}%` }} />
          <span className="seg checked" style={{ width: `${p.total ? (p.checked / p.total) * 100 : 0}%` }} />
        </div>
        <p className="tally">
          <strong>{p.new}</strong> to review · <strong>{p.fixed}</strong> corrected · <strong>{p.checked}</strong> correct as is · {p.total} in all
        </p>
      </div>

      <div className="chips" role="tablist" aria-label="Show">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className="chip" onClick={() => { setFilter(f.id); reset() }}>{f.label}</button>
        ))}
      </div>

      {loading ? <p className="empty">Loading…</p> : !rows.length ? <p className="empty">Nothing here. {filter === 'todo' ? 'Every string of this part is reviewed.' : ''}</p> : (
        <ol className="rows">
          {rows.slice(0, shown).map((s) => <Row key={s.id} s={s} />)}
        </ol>
      )}
      {rows.length > shown && <button type="button" className="more" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}</button>}
    </section>
  )
}

function Row({ s }: { s: Str }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(s.fix || s.builtIn)
  const [phonetic, setPhonetic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const problem = editing ? checkFix(s.builtIn, text) : null

  const act = async (status: Status, fix = '') => {
    setBusy(true)
    setErr('')
    try {
      await review(s, { status, fix })
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error && /permission/i.test(e.message) ? 'Not saved: you are not an editor, or the text breaks a rule.' : 'Not saved. Check the connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`row st-${s.status}`}>
      <div className="meta">
        <span className={`pill ${s.status}`}>{s.status === 'new' ? 'To review' : s.status === 'fixed' ? 'Corrected' : 'Correct as is'}</span>
        {s.group && <span className="group">{s.group}</span>}
        {s.context && <span className="context">{s.context}</span>}
        <span className="where" title={s.where.join('\n')}>{s.where[0] ?? s.key}{s.where.length > 1 ? ` +${s.where.length - 1}` : ''}</span>
      </div>
      {s.en && <p className="en" lang="en">{s.en}</p>}
      <p className={`dv ${s.status === 'fixed' ? 'struck' : ''}`} lang="dv" dir="rtl">{s.builtIn}</p>
      {s.status === 'fixed' && !editing && <p className="dv fix" lang="dv" dir="rtl">{current(s)}</p>}
      {s.status !== 'new' && s.checkedBy && <p className="who">{s.status === 'fixed' ? 'Corrected' : 'Checked'} by {s.checkedBy}</p>}

      {editing ? (
        <div className="editor">
          <label className="sr" htmlFor={`fix-${s.id}`}>Correction</label>
          <textarea
            id={`fix-${s.id}`} lang="dv" dir="rtl" rows={Math.min(8, Math.max(2, Math.ceil(text.length / 60)))} value={text} aria-invalid={!!problem}
            onChange={(e) => setText(phonetic ? toThaana(e.target.value) : e.target.value)}
          />
          <div className="editor-bar">
            <label className="switch"><input id={`ph-${s.id}`} type="checkbox" checked={phonetic} onChange={(e) => setPhonetic(e.target.checked)} /> Type Thaana (phonetic)</label>
            {problem && <span className="problem" role="status">{PROBLEM[problem]}</span>}
          </div>
          <div className="actions">
            <button type="button" className="primary" disabled={busy || !!problem} onClick={() => act('fixed', text)}>Save correction</button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setText(s.fix || s.builtIn) }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="actions">
          {s.status !== 'checked' && <button type="button" disabled={busy} onClick={() => act('checked')}>Correct as it is</button>}
          <button type="button" className={s.status === 'new' ? 'primary' : ''} disabled={busy} onClick={() => setEditing(true)}>{s.status === 'fixed' ? 'Change correction' : 'Write a correction'}</button>
          {s.status !== 'new' && <button type="button" className="quiet" disabled={busy} onClick={() => act('new')}>Back to review</button>}
        </div>
      )}
      {err && <p className="problem" role="alert">{err}</p>}
    </li>
  )
}
