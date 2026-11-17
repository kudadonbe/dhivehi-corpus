import { useEffect, useState } from 'react'
import {
  collection, collectionGroup, doc, getDocs, onSnapshot, query, where, writeBatch,
  serverTimestamp, type DocumentData, type DocumentReference, type Query, type WriteBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { fill, put } from './strings'
import {
  buildExport, emptyForm, emptyRoot, emptySentence, emptySource, emptyWord, snapshot,
  DIALECTS, type Collection, type Dialect, type Form, type FormData, type HistoryEntry, type Meta, type Root, type RootData,
  type Sentence, type SentenceData, type Source, type SourceData, type Word, type WordData,
} from './core/corpus'

// The lexicon in Firestore (firestore.rules: lexicon section), ported from TaxiQ v2.17.0 src/corpus.ts
// with the same collections and shapes, so the data moved from TaxiQ reads and writes unchanged:
// corpusRoots, corpusWords (+ forms/{dialect}), corpusSentences, corpusSources, corpusHistory.
// Every write adds one corpusHistory entry in the same batch (put() in src/strings.ts) and the
// document names it in historyId, which the rules check (corpusLogged). History is never changed.

// A pending server timestamp reads as null until the server answers: show it as now.
const ms = (x: unknown) => (x && typeof (x as { toMillis?: () => number }).toMillis === 'function' ? (x as { toMillis: () => number }).toMillis() : Date.now())
function meta(x: Record<string, unknown>): Meta {
  return { createdBy: String(x.createdBy ?? ''), createdAt: ms(x.createdAt), updatedBy: String(x.updatedBy ?? ''), updatedAt: ms(x.updatedAt) }
}
const isDialect = (id: string): id is Dialect => (DIALECTS as readonly string[]).includes(id)

/* ------------------------------------------------------------------ reading */

// A live list; `make` returns null while there is nothing to listen to. `key` says when to listen again.
function useCol<T>(key: string | null, make: () => Query<DocumentData>, parse: (id: string, x: Record<string, unknown>) => T): T[] {
  const [state, setState] = useState<{ key: string | null; list: T[] }>({ key: null, list: [] })
  useEffect(() => {
    if (key === null) return
    return onSnapshot(make(), (s) => setState({ key, list: s.docs.map((d) => parse(d.id, d.data())) }), () => setState({ key, list: [] }))
    // make and parse are fixed per call site; key says when to listen again.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return key !== null && state.key === key ? state.list : []
}

const parseRoot = (id: string, x: Record<string, unknown>): Root => ({ ...fill(emptyRoot(), x), ...meta(x), id })
const parseWord = (id: string, x: Record<string, unknown>): Word => ({ ...fill(emptyWord(), x), ...meta(x), id })
const parseForm = (id: string, x: Record<string, unknown>): Form => ({ ...fill(emptyForm(), x), ...meta(x), id: id as Dialect })
const parseSentence = (id: string, x: Record<string, unknown>): Sentence => ({ ...fill(emptySentence(), x), ...meta(x), id })
const parseSource = (id: string, x: Record<string, unknown>): Source => ({ ...fill(emptySource(), x), ...meta(x), id })

export const useWords = () => useCol('all', () => collection(db, 'corpusWords'), parseWord)
export const useRoots = () => useCol('all', () => collection(db, 'corpusRoots'), parseRoot)
export const useSources = () => useCol('all', () => collection(db, 'corpusSources'), parseSource)

// One word's dialect forms (only dialects in DIALECTS).
export function useForms(wordId: string | null): Form[] {
  return useCol(wordId, () => collection(db, 'corpusWords', wordId!, 'forms'), parseForm).filter((f) => isDialect(f.id))
}

// Every word's forms by word id (one collection-group query): dialect counts and search in the list.
const NO_FORMS = new Map<string, Form[]>()
export function useAllForms(): Map<string, Form[]> {
  const [map, setMap] = useState<Map<string, Form[]>>(NO_FORMS)
  useEffect(
    () => onSnapshot(
      collectionGroup(db, 'forms'),
      (s) => {
        const m = new Map<string, Form[]>()
        for (const d of s.docs) {
          const word = d.ref.parent.parent
          if (!word || word.parent.id !== 'corpusWords' || !isDialect(d.id)) continue
          m.set(word.id, [...(m.get(word.id) ?? []), parseForm(d.id, d.data())])
        }
        setMap(m)
      },
      () => setMap(NO_FORMS),
    ),
    [],
  )
  return map
}

// Sentences that use a word.
export function useSentences(wordId: string | null): Sentence[] {
  return useCol(wordId, () => query(collection(db, 'corpusSentences'), where('wordIds', 'array-contains', wordId)), parseSentence)
}

// One document's history, newest first (two equality filters: no composite index needed).
export function useHistory(col: Collection, docId: string | null): HistoryEntry[] {
  const list = useCol(
    docId === null ? null : `${col}|${docId}`,
    () => query(collection(db, 'corpusHistory'), where('collection', '==', col), where('docId', '==', docId)),
    (id, x): HistoryEntry => ({
      id,
      collection: col,
      docId: String(x.docId ?? ''),
      action: (['create', 'update', 'delete', 'verify'] as const).find((a) => a === x.action) ?? 'update',
      before: x.before && typeof x.before === 'object' ? (x.before as Record<string, unknown>) : null,
      after: x.after && typeof x.after === 'object' ? (x.after as Record<string, unknown>) : null,
      by: String(x.by ?? ''),
      at: ms(x.at),
    }),
  )
  return [...list].sort((a, b) => b.at - a.at)
}

/* ------------------------------------------------------------------ writing */
// `prev` is the document as loaded (null when creating). Content is reduced to the model's fields
// (fill), so the stored keys are exactly the rules' list plus the meta fields put() adds.

function me(): string {
  const e = auth.currentUser?.email
  if (!e) throw new Error('signed_out')
  return e.toLowerCase()
}

const content = <T extends object>(empty: T, d: T): T => fill(empty, d as Record<string, unknown>)

// Deleting: the document goes, the history keeps its last content as `before`.
function drop(b: WriteBatch, col: Collection, ref: DocumentReference, docId: string, prev: object) {
  b.delete(ref)
  b.set(doc(collection(db, 'corpusHistory')), { collection: col, docId, action: 'delete', before: snapshot(prev), after: null, by: me(), at: serverTimestamp() })
}

async function saveTop<T extends object>(col: Collection, empty: T, id: string | null, d: T, prev: object | null, action?: 'verify'): Promise<string> {
  me()
  const ref = id ? doc(db, col, id) : doc(collection(db, col))
  const b = writeBatch(db)
  put(b, col, ref, ref.id, content(empty, d), prev ? content(empty, prev as T) : null, action)
  await b.commit()
  return ref.id
}

export const saveRoot = (d: RootData, prev: Root | null) => saveTop('corpusRoots', emptyRoot(), prev?.id ?? null, d, prev)
export const saveWord = (d: WordData, prev: Word | null) => saveTop('corpusWords', emptyWord(), prev?.id ?? null, d, prev)
export const saveSentence = (d: SentenceData, prev: Sentence | null) => saveTop('corpusSentences', emptySentence(), prev?.id ?? null, d, prev)
export const saveSource = (d: SourceData, prev: Source | null) => saveTop('corpusSources', emptySource(), prev?.id ?? null, d, prev)

// A dialect form lives at corpusWords/{wordId}/forms/{dialect}; its history docId is 'wordId/dialect'.
export async function saveForm(wordId: string, dialect: Dialect, d: FormData, prev: Form | null) {
  me()
  const b = writeBatch(db)
  put(b, 'corpusForms', doc(db, 'corpusWords', wordId, 'forms', dialect), `${wordId}/${dialect}`, content(emptyForm(), d), prev ? content(emptyForm(), prev) : null)
  await b.commit()
}

// Verify (marks it checked by you) or take the mark off.
export function verifyWord(w: Word, on: boolean) {
  return saveTop('corpusWords', emptyWord(), w.id, { ...content(emptyWord(), w), verified: on, verifiedBy: on ? me() : '' }, w, 'verify')
}
export function verifyRoot(r: Root, on: boolean) {
  return saveTop('corpusRoots', emptyRoot(), r.id, { ...content(emptyRoot(), r), verified: on, verifiedBy: on ? me() : '' }, r, 'verify')
}

// A word goes with its dialect forms, in one batch.
export async function deleteWord(w: Word, forms: Form[]) {
  const b = writeBatch(db)
  for (const f of forms) drop(b, 'corpusForms', doc(db, 'corpusWords', w.id, 'forms', f.id), `${w.id}/${f.id}`, f)
  drop(b, 'corpusWords', doc(db, 'corpusWords', w.id), w.id, w)
  await b.commit()
}
export async function deleteForm(wordId: string, f: Form) {
  const b = writeBatch(db)
  drop(b, 'corpusForms', doc(db, 'corpusWords', wordId, 'forms', f.id), `${wordId}/${f.id}`, f)
  await b.commit()
}
async function deleteTop(col: Collection, x: { id: string }) {
  const b = writeBatch(db)
  drop(b, col, doc(db, col, x.id), x.id, x)
  await b.commit()
}
export const deleteRoot = (r: Root) => deleteTop('corpusRoots', r)
export const deleteSentence = (s: Sentence) => deleteTop('corpusSentences', s)
export const deleteSource = (s: Source) => deleteTop('corpusSources', s)

// The whole lexicon (every word with its forms, and the full history) as JSON text, for a download
// (core/corpus.ts buildExport). History entries of app labels are left out: they are not the lexicon's.
export async function exportLexicon(): Promise<string> {
  const all = async (name: string) => (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }))
  const [roots, words, sentences, sources, history] = await Promise.all(['corpusRoots', 'corpusWords', 'corpusSentences', 'corpusSources', 'corpusHistory'].map(all))
  const forms: Record<string, Record<string, unknown>[]> = {}
  for (const d of (await getDocs(collectionGroup(db, 'forms'))).docs) {
    const word = d.ref.parent.parent
    if (!word || word.parent.id !== 'corpusWords') continue
    ;(forms[word.id] ??= []).push({ id: d.id, ...d.data() })
  }
  const lexiconHistory = history.filter((h) => !['corpusStrings', 'corpusApps'].includes(String((h as Record<string, unknown>).collection)))
  return JSON.stringify(buildExport({ roots, words: words as (Record<string, unknown> & { id: string })[], forms, sentences, sources, history: lexiconHistory }, new Date()), null, 2)
}
