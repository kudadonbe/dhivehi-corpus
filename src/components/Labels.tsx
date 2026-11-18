import { useMemo, useState } from 'react'
import { checkFix, current, progress, stringMatches, type FixProblem, type Status } from '../core/strings'
import { review, useApps, useStrings, type Str } from '../strings'
import { toThaana } from '../thaana'
import { useT } from '../ui/i18n'
import type { UiKey } from '../ui/text'

const PROBLEM = (p: FixProblem) => `fix.${p}` as UiKey
const FILTERS: { id: 'todo' | Status | 'all'; label: UiKey }[] = [
  { id: 'todo', label: 'status.new' },
  { id: 'fixed', label: 'status.fixed' },
  { id: 'checked', label: 'status.checked' },
  { id: 'all', label: 'status.all' },
]
const PAGE = 40

export function Labels() {
  const t = useT()
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

  if (!apps.length) return <p className="empty">{t.rich('labels.noApps', { apps: <strong>{t('nav.apps')}</strong> })}</p>

  return (
    <section className="labels">
      <div className="toolbar">
        <label className="field">
          <span>{t('labels.app')}</span>
          <select id="app" value={app ?? ''} onChange={(e) => { setAppId(e.target.value); setGroup(''); reset() }}>
            {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{t('labels.part')}</span>
          <select id="group" value={group} onChange={(e) => { setGroup(e.target.value); reset() }}>
            <option value="">{t('labels.everyPart')}</option>
            {groups.map((g) => <option key={g} value={g} dir="auto">{g}</option>)}
          </select>
        </label>
        <label className="field grow">
          <span>{t('common.search')}</span>
          <input id="search" type="search" value={q} placeholder={t('labels.searchHint')} onChange={(e) => { setQ(e.target.value); reset() }} />
        </label>
      </div>

      <div className="progress" aria-label={t('labels.progress')}>
        <div className="bar" role="img" aria-label={t('labels.reviewedOf', { done: p.checked + p.fixed, total: p.total })}>
          <span className="seg fixed" style={{ width: `${p.total ? (p.fixed / p.total) * 100 : 0}%` }} />
          <span className="seg checked" style={{ width: `${p.total ? (p.checked / p.total) * 100 : 0}%` }} />
        </div>
        <p className="tally">
          {t.rich('labels.tally', { new: <strong>{p.new}</strong>, fixed: <strong>{p.fixed}</strong>, checked: <strong>{p.checked}</strong>, total: p.total })}
        </p>
      </div>

      <div className="chips" role="tablist" aria-label={t('labels.show')}>
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className="chip" onClick={() => { setFilter(f.id); reset() }}>{t(f.label)}</button>
        ))}
      </div>

      {loading ? <p className="empty">{t('gate.loading')}</p> : !rows.length ? <p className="empty">{t('labels.nothing')} {filter === 'todo' ? t('labels.allReviewed') : ''}</p> : (
        <ol className="rows">
          {rows.slice(0, shown).map((s) => <Row key={s.id} s={s} />)}
        </ol>
      )}
      {rows.length > shown && <button type="button" className="more" onClick={() => setShown(shown + PAGE)}>{t('labels.more', { n: Math.min(PAGE, rows.length - shown), left: rows.length - shown })}</button>}
    </section>
  )
}

function Row({ s }: { s: Str }) {
  const t = useT()
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
      setErr(e instanceof Error && /permission/i.test(e.message) ? t('review.denied') : t('review.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`row st-${s.status}`}>
      <div className="meta">
        <span className={`pill ${s.status}`}>{t(`status.${s.status}` as UiKey)}</span>
        {s.group && <span className="group" dir="auto">{s.group}</span>}
        {s.context && <span className="context" dir="auto">{s.context}</span>}
        <span className="where" dir="ltr" title={s.where.join('\n')}>{s.where[0] ?? s.key}{s.where.length > 1 ? ` +${s.where.length - 1}` : ''}</span>
      </div>
      {s.en && <p className="en" lang="en" dir="ltr">{s.en}</p>}
      <p className={`dv ${s.status === 'fixed' ? 'struck' : ''}`} lang="dv" dir="rtl">{s.builtIn}</p>
      {s.status === 'fixed' && !editing && <p className="dv fix" lang="dv" dir="rtl">{current(s)}</p>}
      {s.status !== 'new' && s.checkedBy && <p className="who">{t.rich(s.status === 'fixed' ? 'review.correctedBy' : 'review.checkedBy', { who: <bdi dir="ltr">{s.checkedBy}</bdi> })}</p>}

      {editing ? (
        <div className="editor">
          <label className="sr" htmlFor={`fix-${s.id}`}>{t('review.correction')}</label>
          <textarea
            id={`fix-${s.id}`} lang="dv" dir="rtl" rows={Math.min(8, Math.max(2, Math.ceil(text.length / 60)))} value={text} aria-invalid={!!problem}
            onChange={(e) => setText(phonetic ? toThaana(e.target.value) : e.target.value)}
          />
          <div className="editor-bar">
            <label className="switch"><input id={`ph-${s.id}`} type="checkbox" checked={phonetic} onChange={(e) => setPhonetic(e.target.checked)} /> {t('common.phonetic')}</label>
            {problem && <span className="problem" role="status">{t(PROBLEM(problem))}</span>}
          </div>
          <div className="actions">
            <button type="button" className="primary" disabled={busy || !!problem} onClick={() => act('fixed', text)}>{t('review.save')}</button>
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setText(s.fix || s.builtIn) }}>{t('common.cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="actions">
          {s.status !== 'checked' && <button type="button" disabled={busy} onClick={() => act('checked')}>{t('review.correctAsIs')}</button>}
          <button type="button" className={s.status === 'new' ? 'primary' : ''} disabled={busy} onClick={() => setEditing(true)}>{t(s.status === 'fixed' ? 'review.change' : 'review.write')}</button>
          {s.status !== 'new' && <button type="button" className="quiet" disabled={busy} onClick={() => act('new')}>{t('review.back')}</button>}
        </div>
      )}
      {err && <p className="problem" role="alert">{err}</p>}
    </li>
  )
}
