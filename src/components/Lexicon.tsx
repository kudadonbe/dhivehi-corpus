import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CATEGORIES, DIALECTS, LIMITS, ORIGINS, PARTS, POS, SOURCE_KINDS, diffSnapshot, emptyForm, emptyRoot, emptySentence, emptySource, emptyWord,
  exportFilename, isValid, matches, snapshot, validateForm, validateRoot, validateSentence, validateSource, validateWord,
  type Collection, type Dialect, type Errors, type FieldError, type Form, type FormData,
  type Root, type RootData, type Sentence, type SentenceData, type Source, type SourceData,
  type Word, type WordData,
} from '../core/corpus'
import { groupByRoot, historyValue, wordSortKey } from '../core/lexicon'
import {
  deleteForm, deleteRoot, deleteSentence, deleteSource, deleteWord, exportLexicon, saveForm, saveRoot, saveSentence, saveSource, saveWord,
  useAllForms, useForms, useHistory, useRoots, useSentences, useSources, useWords, verifyRoot, verifyWord,
} from '../lexicon'
import { toThaana } from '../thaana'
import { useT } from '../ui/i18n'
import { optionKey, UI, type UiKey } from '../ui/text'

// The lexicon editor, ported from TaxiQ v2.17.0 CorpusView: words grouped by root, each word's dialect
// forms and sentences, roots, sources, the history of every document, verify, export. Same checks
// (validate* in core/corpus.ts) and writes (src/lexicon.ts). Wording: src/ui/text.ts.

type Tab = 'words' | 'roots' | 'sources'
interface View { tab: Tab; id: string | null } // id: the open entry, 'new', or null for the list

const ERR = (e: FieldError) => `err.${e}` as UiKey
// A field's label; a field the table does not know (an old history entry) shows its name.
const fieldKey = (f: string) => (`field.${f}` in UI ? (`field.${f}` as UiKey) : null)
const FIELD = (f: string) => `field.${f}` as UiKey

// The content of a stored document, to compare with the form's draft.
const same = (a: object | null, b: object) => diffSnapshot(snapshot(a), snapshot(b)).length === 0
// A stored document's content fields only (a form's draft).
function pick<T extends object>(empty: T, x: object): T {
  return Object.fromEntries(Object.keys(empty).map((k) => [k, (x as Record<string, unknown>)[k]])) as T
}

// Typing Thaana with the phonetic layout (src/thaana.ts): one switch for every Thaana field here.
const Phonetic = createContext(false)

export function Lexicon() {
  const t = useT()
  const words = useWords()
  const roots = useRoots()
  const sources = useSources()
  const forms = useAllForms()
  const [view, setView] = useState<View>({ tab: 'words', id: null })
  const [phonetic, setPhonetic] = useState(false)
  const [exporting, setExporting] = useState<'idle' | 'busy' | 'failed'>('idle')
  const open = (tab: Tab, id: string | null) => setView({ tab, id })

  const doExport = async () => {
    setExporting('busy')
    try {
      const json = await exportLexicon()
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      Object.assign(document.createElement('a'), { href: url, download: exportFilename(new Date()) }).click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExporting('idle')
    } catch {
      setExporting('failed')
    }
  }

  const tabs: [Tab, UiKey, number][] = [['words', 'lex.words', words.length], ['roots', 'lex.roots', roots.length], ['sources', 'lex.sources', sources.length]]
  return (
    <Phonetic.Provider value={phonetic}>
      <section className="lexicon">
        <div className="section-head">
          <h2>{t('nav.lexicon')}</h2>
          <button type="button" onClick={doExport} disabled={exporting === 'busy'}>{t(exporting === 'busy' ? 'lex.exporting' : 'lex.export')}</button>
        </div>
        <p className="hint">{t('lex.hint')}</p>
        {exporting === 'failed' && <p className="problem" role="alert">{t('lex.exportFailed')}</p>}
        <div className="lex-bar">
          <div className="chips" role="tablist" aria-label={t('nav.lexicon')}>
            {tabs.map(([id, label, n]) => (
              <button key={id} type="button" role="tab" aria-selected={view.tab === id} className="chip" onClick={() => open(id, null)}>{t(label)} <span className="count">{n}</span></button>
            ))}
          </div>
          <label className="switch"><input id="lex-phonetic" type="checkbox" checked={phonetic} onChange={(e) => setPhonetic(e.target.checked)} /> {t('common.phonetic')}</label>
        </div>
        {view.tab === 'words' ? (
          <WordsTab id={view.id} open={(id) => open('words', id)} openRoot={(id) => open('roots', id)} words={words} roots={roots} sources={sources} forms={forms} />
        ) : view.tab === 'roots' ? (
          <RootsTab id={view.id} open={(id) => open('roots', id)} openWord={(id) => open('words', id)} roots={roots} words={words} sources={sources} />
        ) : (
          <SourcesTab id={view.id} open={(id) => open('sources', id)} sources={sources} />
        )}
      </section>
    </Phonetic.Provider>
  )
}

/* ------------------------------------------------------------------ small parts */

function Field({ label, err, children }: { label: string; err?: FieldError; children: ReactNode }) {
  const t = useT()
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {err && <span className="problem">{t(ERR(err))}</span>}
    </label>
  )
}

// A text field. Thaana fields are right to left in the Dhivehi face and follow the phonetic switch.
function Text({ value, onChange, thaana, multiline, max, err }: { value: string; onChange: (v: string) => void; thaana?: boolean; multiline?: boolean; max: number; err?: boolean }) {
  const phonetic = useContext(Phonetic)
  const props = {
    value,
    maxLength: max,
    'aria-invalid': err || undefined,
    className: thaana ? 'dv-input' : 'plain',
    onChange: (e: { target: { value: string } }) => onChange(thaana && phonetic ? toThaana(e.target.value) : e.target.value),
    ...(thaana ? { dir: 'rtl' as const, lang: 'dv' } : { dir: 'auto' as const }),
  }
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />
}

function Choose<V extends string>({ value, options, prefix, onChange }: { value: V; options: readonly V[]; prefix: string; onChange: (v: V) => void }) {
  const t = useT()
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as V)}>
      {options.map((o) => <option key={o} value={o}>{t(optionKey(prefix, o))}</option>)}
    </select>
  )
}

const Dv = ({ children, className = '' }: { children: ReactNode; className?: string }) => <span lang="dv" dir="rtl" className={className}>{children}</span>
function Verified() {
  const t = useT()
  return <span className="pill verified">{t('lex.verified')}</span>
}

// Two taps to delete (no browser dialog); the first tap arms it for a few seconds.
function DeleteButton({ onDelete }: { onDelete: () => Promise<unknown> }) {
  const t = useT()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(timer)
  }, [armed])
  return (
    <>
      <button
        type="button" className={`danger${armed ? ' armed' : ''}`} disabled={busy}
        onClick={() => {
          if (!armed) return setArmed(true)
          setBusy(true)
          setFailed(false)
          onDelete().catch(() => { setBusy(false); setArmed(false); setFailed(true) })
        }}
      >
        {t(armed ? 'common.deleteArmed' : 'common.delete')}
      </button>
      {failed && <span className="problem" role="alert">{t('common.notDeleted')}</span>}
    </>
  )
}

// Save with its state: busy, saved, failed.
type SaveState = 'idle' | 'busy' | 'saved' | 'failed'
function useSaver() {
  const [state, setState] = useState<SaveState>('idle')
  const run = async (f: () => Promise<unknown>) => {
    setState('busy')
    try {
      await f()
      setState('saved')
    } catch {
      setState('failed')
    }
  }
  return { state, run, reset: () => setState('idle') }
}

function SaveRow({ state, disabled, onSave, children }: { state: SaveState; disabled: boolean; onSave: () => void; children?: ReactNode }) {
  const t = useT()
  return (
    <>
      <div className="actions">
        <button type="button" className="primary" disabled={disabled || state === 'busy'} onClick={onSave}>{t(state === 'busy' ? 'common.saving' : 'common.save')}</button>
        {children}
        {state === 'saved' && <span className="status saved" role="status">{t('common.saved')}</span>}
      </div>
      {state === 'failed' && <p className="problem" role="alert">{t('common.notSavedFields')}</p>}
    </>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  const t = useT()
  return <button type="button" className="quiet back" onClick={onClick}>{t('common.back')}</button>
}

// A list's search box and its New button.
function ListBar({ q, setQ, placeholder, newLabel, onNew }: { q: string; setQ: (v: string) => void; placeholder: string; newLabel: string; onNew: () => void }) {
  const t = useT()
  return (
    <div className="toolbar lex-search">
      <label className="field grow">
        <span>{t('common.search')}</span>
        <input type="search" dir="auto" value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} />
      </label>
      <button type="button" className="primary" onClick={onNew}>{newLabel}</button>
    </div>
  )
}

// A folding part of an editor (dialect forms, sentences, history).
function Fold({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="card fold" open={open}>
      <summary>{title}</summary>
      <div className="fold-body">{children}</div>
    </details>
  )
}

// Cited sources: chips with Remove, a picker for the others, and a new source inline.
function SourcePicker({ value, sources, onChange }: { value: string[]; sources: Source[]; onChange: (v: string[]) => void }) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<SourceData>(emptySource())
  const saver = useSaver()
  const byId = new Map(sources.map((s) => [s.id, s]))
  const rest = sources.filter((s) => !value.includes(s.id)).sort((a, b) => a.title.localeCompare(b.title))
  const errs = validateSource(draft)
  return (
    <div className="picker">
      <span className="picker-label">{t('field.sources')}</span>
      {value.length > 0 && (
        <ul className="cites">
          {value.map((id) => {
            const name = byId.get(id)?.title ?? t('lex.removedSource')
            return (
              <li key={id} className="cite">
                <span className="cite-name" dir="auto">{name}</span>
                <button type="button" className="x" aria-label={t('lex.removeNamed', { name })} onClick={() => onChange(value.filter((x) => x !== id))}>×</button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="actions">
        {rest.length > 0 && value.length < LIMITS.sources && (
          <select className="cite-pick" value="" aria-label={t('lex.citeSource')} onChange={(e) => e.target.value && onChange([...value, e.target.value])}>
            <option value="">{t('lex.citeSource')}</option>
            {rest.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}
        <button type="button" onClick={() => setAdding(!adding)} aria-expanded={adding}>{t('lex.newSourcePlus')}</button>
      </div>
      {adding && (
        <div className="inset">
          <SourceFields d={draft} set={setDraft} errs={errs} />
          <SaveRow
            state={saver.state} disabled={!isValid(errs)}
            onSave={() => saver.run(async () => {
              const id = await saveSource(draft, null)
              onChange([...value, id])
              setDraft(emptySource())
              setAdding(false)
            })}
          >
            <button type="button" onClick={() => setAdding(false)}>{t('common.cancel')}</button>
          </SaveRow>
        </div>
      )}
    </div>
  )
}

// The word's root: search roots and pick one, or add a new root inline.
function RootPicker({ value, roots, onChange }: { value: string; roots: Root[]; onChange: (id: string) => void }) {
  const t = useT()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<RootData>(emptyRoot())
  const saver = useSaver()
  const current = roots.find((r) => r.id === value)
  const found = q.trim() ? roots.filter((r) => matches(q, [r.thaana, r.latin, r.meaningEn, r.meaningDv])).slice(0, 8) : []
  const errs = validateRoot(draft)
  return (
    <div className="picker">
      <span className="picker-label">{t('field.rootId')}</span>
      {value ? (
        <ul className="cites">
          <li className="cite root">
            {current ? <span className="cite-name"><Dv className="dv-word">{current.thaana}</Dv> {current.latin}</span> : <span className="cite-name">{t('lex.removedRoot')}</span>}
            <button type="button" className="x" aria-label={t('lex.removeRoot')} onClick={() => onChange('')}>×</button>
          </li>
        </ul>
      ) : <span className="hint">{t('lex.noRoot')}</span>}
      <div className="actions">
        <input className="grow-input" type="search" dir="auto" placeholder={t('lex.searchRoots')} aria-label={t('lex.searchRoots')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" onClick={() => setAdding(!adding)} aria-expanded={adding}>{t('lex.newRootPlus')}</button>
      </div>
      {found.length > 0 && (
        <ul className="cites">
          {found.map((r) => (
            <li key={r.id}>
              <button type="button" className="pick" onClick={() => { onChange(r.id); setQ('') }}>
                <Dv className="dv-word">{r.thaana}</Dv>{r.latin && <span className="hint">{r.latin}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <div className="inset">
          <div className="grid2">
            <Field label={t(FIELD('thaana'))} err={errs.thaana}><Text thaana value={draft.thaana} max={LIMITS.word} err={!!errs.thaana} onChange={(v) => setDraft({ ...draft, thaana: v })} /></Field>
            <Field label={t(FIELD('latin'))} err={errs.latin}><Text value={draft.latin} max={LIMITS.word} onChange={(v) => setDraft({ ...draft, latin: v })} /></Field>
          </div>
          <SaveRow
            state={saver.state} disabled={!isValid(errs)}
            onSave={() => saver.run(async () => {
              onChange(await saveRoot(draft, null))
              setDraft(emptyRoot())
              setAdding(false)
            })}
          >
            <button type="button" onClick={() => setAdding(false)}>{t('common.cancel')}</button>
          </SaveRow>
        </div>
      )}
    </div>
  )
}

// Who changed what and when, newest first.
function HistoryList({ col, docId, sources }: { col: Collection; docId: string; sources: Source[] }) {
  const t = useT()
  const entries = useHistory(col, docId)
  const byId = new Map(sources.map((s) => [s.id, s.title]))
  if (!entries.length) return <p className="hint">{t('lex.noHistory')}</p>
  return (
    <ol className="history">
      {entries.slice(0, 50).map((e) => {
        const changes = diffSnapshot(e.before, e.after)
        return (
          <li key={e.id}>
            <p className="meta"><strong>{t(`action.${e.action}` as UiKey)}</strong> <bdi className="where" dir="ltr">{e.by}</bdi> <bdi dir="ltr">{new Date(e.at).toLocaleString('en-GB')}</bdi></p>
            {e.action !== 'delete' && changes.length > 0 && (
              <ul className="changes">
                {changes.map((c) => (
                  <li key={c.field}>
                    <span className="field-name">{(() => { const k = fieldKey(c.field); return k ? t(k) : c.field })()}:</span>{' '}
                    <del dir="auto">{historyValue(c.before, c.field, (id) => byId.get(id))}</del>{' '}
                    <ins dir="auto">{historyValue(c.after, c.field, (id) => byId.get(id))}</ins>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ------------------------------------------------------------------ words */

function WordsTab({ id, open, openRoot, words, roots, sources, forms }: {
  id: string | null; open: (id: string | null) => void; openRoot: (id: string) => void; words: Word[]; roots: Root[]; sources: Source[]; forms: Map<string, Form[]>
}) {
  const t = useT()
  const [q, setQ] = useState('')
  const groups = useMemo(() => groupByRoot(words, roots, q, forms), [words, roots, q, forms])
  if (id) {
    const word = id === 'new' ? null : words.find((w) => w.id === id)
    if (word === undefined) return <><BackButton onClick={() => open(null)} /><p className="empty">{t('lex.wordGone')}</p></>
    return <WordEditor key={id} word={word} roots={roots} sources={sources} onClose={() => open(null)} onCreated={open} />
  }
  const shown = groups.reduce((n, g) => n + g.words.length, 0)
  return (
    <>
      <ListBar q={q} setQ={setQ} placeholder={t('lex.wordSearch')} newLabel={t('lex.newWord')} onNew={() => open('new')} />
      {words.length === 0 ? <p className="empty">{t.rich('lex.noWords', { doc: <code>docs/MIGRATION.md</code> })}</p>
        : shown === 0 ? <p className="empty">{t('common.nothingMatches')}</p>
        : <p className="tally">{t('lex.wordTally', { words: shown, roots: groups.filter((g) => g.root).length })}{groups.some((g) => !g.root) ? t('lex.wordTallyNoRoot', { n: groups.find((g) => !g.root)!.words.length }) : ''}</p>}
      <div className="groups">
        {groups.map((g) => (
          <section key={g.root?.id ?? ''} className="group-block" aria-label={g.root ? t('lex.rootAria', { name: g.root.thaana || g.root.latin }) : t('lex.noRootAria')}>
            {g.root ? (
              <button type="button" className="root-head" onClick={() => openRoot(g.root!.id)} title={t('lex.openRoot')}>
                <Dv className="dv-head">{g.root.thaana}</Dv>
                {g.root.latin && <bdi className="latin" dir="ltr">{g.root.latin}</bdi>}
                {g.root.meaningEn && <span className="hint clip" lang="en" dir="ltr">{g.root.meaningEn}</span>}
                {g.root.verified && <Verified />}
              </button>
            ) : <h3 className="root-head none">{t('lex.noRoot')}</h3>}
            <ul className="entry-list">
              {g.words.map((w) => {
                const n = forms.get(w.id)?.length ?? 0
                return (
                  <li key={w.id}>
                    <button type="button" className="entry" onClick={() => open(w.id)}>
                      {w.thaana ? <Dv className="dv-word">{w.thaana}</Dv> : <span className="pill">{t('lex.draft')}</span>}
                      <span className="entry-text">
                        {w.latin && <bdi className="latin" dir="ltr">{w.latin}</bdi>}
                        {w.meaningEn && <span className="hint clip" lang="en" dir="ltr">{w.meaningEn}</span>}
                      </span>
                      <span className="entry-tags">
                        {w.category && <span className="pill">{t(optionKey('category', w.category))}</span>}
                        {n > 0 && <span className="hint">{t('lex.dialectsN', { n })}</span>}
                        {w.verified && <Verified />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}

function WordEditor({ word, roots, sources, onClose, onCreated }: { word: Word | null; roots: Root[]; sources: Source[]; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useT()
  const [d, setD] = useState<WordData>(() => (word ? pick(emptyWord(), word) : emptyWord()))
  const saver = useSaver()
  const verifier = useSaver()
  const errs: Errors = validateWord(d)
  const dirty = !word || !same(word, d)
  const set = (p: Partial<WordData>) => { setD({ ...d, ...p }); saver.reset() }
  const forms = useForms(word?.id ?? null)
  const plantish = d.category === 'medicine' || d.category === 'plant' || !!d.scientificName || !!d.partUsed
  return (
    <div className="editor-page">
      <BackButton onClick={onClose} />
      <div className="card">
        <div className="section-head">
          <h3>{word ? (word.thaana ? <Dv className="dv-head">{word.thaana}</Dv> : <bdi dir="ltr">{word.latin}</bdi>) : t('lex.newWord')}</h3>
          {word?.verified && <Verified />}
        </div>
        {word?.verified && word.verifiedBy && <p className="hint">{t.rich('lex.verifiedBy', { who: <bdi dir="ltr">{word.verifiedBy}</bdi> })}</p>}
        <div className="grid2">
          <Field label={t(FIELD('thaana'))} err={errs.thaana}><Text thaana value={d.thaana} max={LIMITS.word} err={!!errs.thaana} onChange={(v) => set({ thaana: v })} /></Field>
          <Field label={t(FIELD('latin'))} err={errs.latin}><Text value={d.latin} max={LIMITS.word} onChange={(v) => set({ latin: v })} /></Field>
          <Field label={t(FIELD('pos'))} err={errs.pos}><Choose value={d.pos} options={POS} prefix="pos" onChange={(v) => set({ pos: v })} /></Field>
          <Field label={t(FIELD('category'))} err={errs.category}><Choose value={d.category} options={CATEGORIES} prefix="category" onChange={(v) => set({ category: v })} /></Field>
          <Field label={t(FIELD('meaningEn'))} err={errs.meaningEn}><Text multiline value={d.meaningEn} max={LIMITS.meaning} onChange={(v) => set({ meaningEn: v })} /></Field>
          <Field label={t(FIELD('meaningDv'))} err={errs.meaningDv}><Text multiline thaana value={d.meaningDv} max={LIMITS.meaning} onChange={(v) => set({ meaningDv: v })} /></Field>
          {plantish && (
            <>
              <Field label={t(FIELD('scientificName'))} err={errs.scientificName}><Text value={d.scientificName} max={LIMITS.word} onChange={(v) => set({ scientificName: v })} /></Field>
              <Field label={t(FIELD('partUsed'))} err={errs.partUsed}><Choose value={d.partUsed} options={PARTS} prefix="part" onChange={(v) => set({ partUsed: v })} /></Field>
            </>
          )}
        </div>
        <RootPicker value={d.rootId} roots={roots} onChange={(v) => set({ rootId: v })} />
        <Field label={t(FIELD('notes'))} err={errs.notes}><Text multiline value={d.notes} max={LIMITS.notes} onChange={(v) => set({ notes: v })} /></Field>
        <SourcePicker value={d.sources} sources={sources} onChange={(v) => set({ sources: v })} />
        <SaveRow
          state={saver.state} disabled={!isValid(errs) || !dirty}
          onSave={() => saver.run(async () => {
            const id = await saveWord(d, word)
            if (!word) onCreated(id)
          })}
        >
          {word && (
            <>
              <button type="button" disabled={dirty || verifier.state === 'busy'} onClick={() => verifier.run(() => verifyWord(word, !word.verified))}>{t(word.verified ? 'lex.unverify' : 'lex.verify')}</button>
              <DeleteButton onDelete={async () => { await deleteWord(word, forms); onClose() }} />
            </>
          )}
        </SaveRow>
        {word && dirty && <p className="hint">{t('lex.saveBeforeVerify')}</p>}
        {verifier.state === 'failed' && <p className="problem" role="alert">{t('common.notSavedRetry')}</p>}
      </div>
      {word ? (
        <>
          <Fold title={t('lex.formsFold', { n: forms.length, all: DIALECTS.length })} open>
            <ul className="entry-list">
              {DIALECTS.map((dl) => <FormRow key={dl} wordId={word.id} dialect={dl} form={forms.find((f) => f.id === dl) ?? null} sources={sources} />)}
            </ul>
          </Fold>
          <Fold title={t('lex.sentences')} open><Sentences wordId={word.id} sources={sources} /></Fold>
          <Fold title={t('lex.history')}><HistoryList col="corpusWords" docId={word.id} sources={sources} /></Fold>
        </>
      ) : <p className="hint">{t('lex.saveWordFirst')}</p>}
    </div>
  )
}

// One dialect's form of the word: folded to a summary until opened.
function FormRow({ wordId, dialect, form, sources }: { wordId: string; dialect: Dialect; form: Form | null; sources: Source[] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [d, setD] = useState<FormData>(() => (form ? pick(emptyForm(), form) : emptyForm()))
  const saver = useSaver()
  const errs = validateForm(d)
  const set = (p: Partial<FormData>) => { setD({ ...d, ...p }); saver.reset() }
  const empty = !d.thaana && !d.latin && !d.pronunciation && !d.notes && !d.speaker && !d.sources.length
  return (
    <li className="form-row">
      <button
        type="button" className="form-head" aria-expanded={open}
        onClick={() => { if (!open) setD(form ? pick(emptyForm(), form) : emptyForm()); setOpen(!open) }}
      >
        <span className="dialect">{t(optionKey('dialect', dialect))}</span>
        <span className="entry-text inline">
          {form ? <>{form.thaana && <Dv className="dv-word">{form.thaana}</Dv>}{form.latin && <bdi className="hint" dir="ltr">{form.latin}</bdi>}</> : <span className="hint">–</span>}
        </span>
        <span aria-hidden="true" className="caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="form-body">
          <div className="grid2">
            <Field label={t(FIELD('thaana'))} err={errs.thaana}><Text thaana value={d.thaana} max={LIMITS.word} err={!!errs.thaana} onChange={(v) => set({ thaana: v })} /></Field>
            <Field label={t(FIELD('latin'))} err={errs.latin}><Text value={d.latin} max={LIMITS.word} onChange={(v) => set({ latin: v })} /></Field>
            <Field label={t(FIELD('pronunciation'))} err={errs.pronunciation}><Text value={d.pronunciation} max={LIMITS.pronunciation} onChange={(v) => set({ pronunciation: v })} /></Field>
            <Field label={t(FIELD('speaker'))} err={errs.speaker}><Text value={d.speaker} max={LIMITS.speaker} err={!!errs.speaker} onChange={(v) => set({ speaker: v })} /></Field>
          </div>
          <Field label={t(FIELD('notes'))} err={errs.notes}><Text multiline value={d.notes} max={LIMITS.notes} onChange={(v) => set({ notes: v })} /></Field>
          <SourcePicker value={d.sources} sources={sources} onChange={(v) => set({ sources: v })} />
          <SaveRow state={saver.state} disabled={!isValid(errs) || (form ? same(form, d) : empty)} onSave={() => saver.run(() => saveForm(wordId, dialect, d, form))}>
            {form && <DeleteButton onDelete={() => deleteForm(wordId, form).then(() => setD(emptyForm()))} />}
          </SaveRow>
          {form && <Fold title={t('lex.history')}><HistoryList col="corpusForms" docId={`${wordId}/${dialect}`} sources={sources} /></Fold>}
        </div>
      )}
    </li>
  )
}

function Sentences({ wordId, sources }: { wordId: string; sources: Source[] }) {
  const t = useT()
  const list = useSentences(wordId)
  const [editing, setEditing] = useState<string | null>(null)
  return (
    <>
      {list.length === 0 && editing !== 'new' && <p className="hint">{t('lex.noSentences')}</p>}
      <ul className="entry-list">
        {list.map((s) => (
          <li key={s.id}>
            {editing === s.id ? <SentenceEditor sentence={s} wordId={wordId} sources={sources} onDone={() => setEditing(null)} /> : (
              <button type="button" className="entry stacked" onClick={() => setEditing(s.id)}>
                <Dv className="dv">{s.thaana}</Dv>
                {s.translationEn && <span className="hint" lang="en" dir="ltr">{s.translationEn}</span>}
                {s.dialect && <span className="pill">{t(optionKey('dialect', s.dialect))}</span>}
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing === 'new'
        ? <SentenceEditor sentence={null} wordId={wordId} sources={sources} onDone={() => setEditing(null)} />
        : <div className="actions"><button type="button" onClick={() => setEditing('new')}>{t('lex.addSentence')}</button></div>}
    </>
  )
}

function SentenceEditor({ sentence, wordId, sources, onDone }: { sentence: Sentence | null; wordId: string; sources: Source[]; onDone: () => void }) {
  const t = useT()
  const [d, setD] = useState<SentenceData>(() => (sentence ? pick(emptySentence(), sentence) : { ...emptySentence(), wordIds: [wordId] }))
  const saver = useSaver()
  const errs = validateSentence(d)
  const set = (p: Partial<SentenceData>) => setD({ ...d, ...p })
  return (
    <div className="inset">
      <Field label={t('lex.sentenceThaana')} err={errs.thaana}><Text thaana multiline value={d.thaana} max={LIMITS.meaning} err={!!errs.thaana} onChange={(v) => set({ thaana: v })} /></Field>
      <Field label={t(FIELD('translationEn'))} err={errs.translationEn}><Text multiline value={d.translationEn} max={LIMITS.meaning} onChange={(v) => set({ translationEn: v })} /></Field>
      <Field label={t(FIELD('dialect'))} err={errs.dialect}><Choose value={d.dialect} options={['', ...DIALECTS]} prefix="dialect" onChange={(v) => set({ dialect: v })} /></Field>
      <Field label={t(FIELD('notes'))} err={errs.notes}><Text multiline value={d.notes} max={LIMITS.notes} onChange={(v) => set({ notes: v })} /></Field>
      <SourcePicker value={d.sources} sources={sources} onChange={(v) => set({ sources: v })} />
      <SaveRow state={saver.state} disabled={!isValid(errs) || (!!sentence && same(sentence, d))} onSave={() => saver.run(async () => { await saveSentence(d, sentence); onDone() })}>
        <button type="button" onClick={onDone}>{t('common.cancel')}</button>
        {sentence && <DeleteButton onDelete={() => deleteSentence(sentence).then(onDone)} />}
      </SaveRow>
      {sentence && <Fold title={t('lex.history')}><HistoryList col="corpusSentences" docId={sentence.id} sources={sources} /></Fold>}
    </div>
  )
}

/* ------------------------------------------------------------------ roots */

function RootsTab({ id, open, openWord, roots, words, sources }: { id: string | null; open: (id: string | null) => void; openWord: (id: string) => void; roots: Root[]; words: Word[]; sources: Source[] }) {
  const t = useT()
  const [q, setQ] = useState('')
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const w of words) if (w.rootId) m.set(w.rootId, (m.get(w.rootId) ?? 0) + 1)
    return m
  }, [words])
  if (id) {
    const root = id === 'new' ? null : roots.find((r) => r.id === id)
    if (root === undefined) return <><BackButton onClick={() => open(null)} /><p className="empty">{t('lex.rootGone')}</p></>
    return <RootEditor key={id} root={root} words={words} sources={sources} onClose={() => open(null)} onCreated={open} openWord={openWord} />
  }
  const list = roots.filter((r) => matches(q, [r.thaana, r.latin, r.meaningEn, r.meaningDv])).sort((a, b) => a.thaana.localeCompare(b.thaana))
  return (
    <>
      <ListBar q={q} setQ={setQ} placeholder={t('lex.rootSearch')} newLabel={t('lex.newRoot')} onNew={() => open('new')} />
      {roots.length === 0 ? <p className="empty">{t('lex.noRoots')}</p> : list.length === 0 && <p className="empty">{t('common.nothingMatches')}</p>}
      <ul className="entry-list">
        {list.map((r) => (
          <li key={r.id}>
            <button type="button" className="entry" onClick={() => open(r.id)}>
              <Dv className="dv-word">{r.thaana}</Dv>
              <span className="entry-text">
                {r.latin && <bdi className="latin" dir="ltr">{r.latin}</bdi>}
                {r.meaningEn && <span className="hint clip" lang="en" dir="ltr">{r.meaningEn}</span>}
              </span>
              <span className="entry-tags">
                {r.origin && <span className="pill">{t(optionKey('origin', r.origin))}</span>}
                <span className="hint">{t('lex.wordsN', { n: counts.get(r.id) ?? 0 })}</span>
                {r.verified && <Verified />}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function RootEditor({ root, words, sources, onClose, onCreated, openWord }: { root: Root | null; words: Word[]; sources: Source[]; onClose: () => void; onCreated: (id: string) => void; openWord: (id: string) => void }) {
  const t = useT()
  const [d, setD] = useState<RootData>(() => (root ? pick(emptyRoot(), root) : emptyRoot()))
  const saver = useSaver()
  const verifier = useSaver()
  const errs = validateRoot(d)
  const dirty = !root || !same(root, d)
  const set = (p: Partial<RootData>) => { setD({ ...d, ...p }); saver.reset() }
  const its = root ? words.filter((w) => w.rootId === root.id).sort((a, b) => wordSortKey(a).localeCompare(wordSortKey(b))) : []
  return (
    <div className="editor-page">
      <BackButton onClick={onClose} />
      <div className="card">
        <div className="section-head">
          <h3>{root ? <Dv className="dv-head">{root.thaana}</Dv> : t('lex.newRoot')}</h3>
          {root?.verified && <Verified />}
        </div>
        {root?.verified && root.verifiedBy && <p className="hint">{t.rich('lex.verifiedBy', { who: <bdi dir="ltr">{root.verifiedBy}</bdi> })}</p>}
        <div className="grid2">
          <Field label={t(FIELD('thaana'))} err={errs.thaana}><Text thaana value={d.thaana} max={LIMITS.word} err={!!errs.thaana} onChange={(v) => set({ thaana: v })} /></Field>
          <Field label={t(FIELD('latin'))} err={errs.latin}><Text value={d.latin} max={LIMITS.word} onChange={(v) => set({ latin: v })} /></Field>
          <Field label={t(FIELD('meaningEn'))} err={errs.meaningEn}><Text multiline value={d.meaningEn} max={LIMITS.meaning} onChange={(v) => set({ meaningEn: v })} /></Field>
          <Field label={t(FIELD('meaningDv'))} err={errs.meaningDv}><Text multiline thaana value={d.meaningDv} max={LIMITS.meaning} onChange={(v) => set({ meaningDv: v })} /></Field>
          <Field label={t(FIELD('origin'))} err={errs.origin}><Choose value={d.origin} options={ORIGINS} prefix="origin" onChange={(v) => set({ origin: v })} /></Field>
        </div>
        <Field label={t(FIELD('notes'))} err={errs.notes}><Text multiline value={d.notes} max={LIMITS.notes} onChange={(v) => set({ notes: v })} /></Field>
        <SourcePicker value={d.sources} sources={sources} onChange={(v) => set({ sources: v })} />
        <SaveRow
          state={saver.state} disabled={!isValid(errs) || !dirty}
          onSave={() => saver.run(async () => {
            const id = await saveRoot(d, root)
            if (!root) onCreated(id)
          })}
        >
          {root && (
            <>
              <button type="button" disabled={dirty || verifier.state === 'busy'} onClick={() => verifier.run(() => verifyRoot(root, !root.verified))}>{t(root.verified ? 'lex.unverify' : 'lex.verify')}</button>
              <DeleteButton onDelete={async () => { await deleteRoot(root); onClose() }} />
            </>
          )}
        </SaveRow>
        {root && dirty && <p className="hint">{t('lex.saveBeforeVerify')}</p>}
        {verifier.state === 'failed' && <p className="problem" role="alert">{t('common.notSavedRetry')}</p>}
      </div>
      {root && (
        <>
          <Fold title={t('lex.wordsFold', { n: its.length })} open>
            {its.length ? (
              <ul className="cites">
                {its.map((w) => (
                  <li key={w.id}>
                    <button type="button" className="pick" onClick={() => openWord(w.id)}>
                      {w.thaana && <Dv className="dv-word">{w.thaana}</Dv>}{w.latin && <span className="hint">{w.latin}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="hint">{t('lex.noWordsUnderRoot')}</p>}
          </Fold>
          <Fold title={t('lex.history')}><HistoryList col="corpusRoots" docId={root.id} sources={sources} /></Fold>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ sources */

function SourceFields({ d, set, errs }: { d: SourceData; set: (d: SourceData) => void; errs: Errors }) {
  const t = useT()
  return (
    <div className="grid2">
      <Field label={t(FIELD('kind'))} err={errs.kind}><Choose value={d.kind} options={SOURCE_KINDS} prefix="sourceKind" onChange={(v) => set({ ...d, kind: v })} /></Field>
      <Field label={t(FIELD('title'))} err={errs.title}><Text value={d.title} max={LIMITS.title} err={!!errs.title} onChange={(v) => set({ ...d, title: v })} /></Field>
      <Field label={t(FIELD('author'))} err={errs.author}><Text value={d.author} max={LIMITS.title} onChange={(v) => set({ ...d, author: v })} /></Field>
      <Field label={t(FIELD('year'))} err={errs.year}><Text value={d.year} max={LIMITS.year} onChange={(v) => set({ ...d, year: v })} /></Field>
      <Field label={t(FIELD('details'))} err={errs.details}><Text multiline value={d.details} max={LIMITS.details} onChange={(v) => set({ ...d, details: v })} /></Field>
      <Field label={t(FIELD('permission'))} err={errs.permission}><Text multiline value={d.permission} max={LIMITS.title} onChange={(v) => set({ ...d, permission: v })} /></Field>
    </div>
  )
}

function SourcesTab({ id, open, sources }: { id: string | null; open: (id: string | null) => void; sources: Source[] }) {
  const t = useT()
  const [q, setQ] = useState('')
  if (id) {
    const source = id === 'new' ? null : sources.find((s) => s.id === id)
    if (source === undefined) return <><BackButton onClick={() => open(null)} /><p className="empty">{t('lex.sourceGone')}</p></>
    return <SourceEditor key={id} source={source} sources={sources} onClose={() => open(null)} onCreated={open} />
  }
  const list = sources.filter((s) => matches(q, [s.title, s.author, s.details, s.year])).sort((a, b) => a.title.localeCompare(b.title))
  return (
    <>
      <ListBar q={q} setQ={setQ} placeholder={t('lex.sourceSearch')} newLabel={t('lex.newSource')} onNew={() => open('new')} />
      {sources.length === 0 ? <p className="empty">{t('lex.noSources')}</p> : list.length === 0 && <p className="empty">{t('common.nothingMatches')}</p>}
      <ul className="entry-list">
        {list.map((s) => (
          <li key={s.id}>
            <button type="button" className="entry stacked" onClick={() => open(s.id)}>
              <strong dir="auto">{s.title}</strong>
              <span className="hint" dir="auto">{[t(optionKey('sourceKind', s.kind)), s.author, s.year, s.details].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function SourceEditor({ source, sources, onClose, onCreated }: { source: Source | null; sources: Source[]; onClose: () => void; onCreated: (id: string) => void }) {
  const t = useT()
  const [d, setD] = useState<SourceData>(() => (source ? pick(emptySource(), source) : emptySource()))
  const saver = useSaver()
  const errs = validateSource(d)
  const dirty = !source || !same(source, d)
  return (
    <div className="editor-page">
      <BackButton onClick={onClose} />
      <div className="card">
        <h3>{source ? <bdi dir="auto">{source.title}</bdi> : t('lex.newSource')}</h3>
        <SourceFields d={d} set={(x) => { setD(x); saver.reset() }} errs={errs} />
        <SaveRow
          state={saver.state} disabled={!isValid(errs) || !dirty}
          onSave={() => saver.run(async () => {
            const id = await saveSource(d, source)
            if (!source) onCreated(id)
          })}
        >
          {source && <DeleteButton onDelete={async () => { await deleteSource(source); onClose() }} />}
        </SaveRow>
      </div>
      {source && <Fold title={t('lex.history')}><HistoryList col="corpusSources" docId={source.id} sources={sources} /></Fold>}
    </div>
  )
}
