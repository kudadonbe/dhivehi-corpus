import { useEffect, useState } from 'react'
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where, writeBatch,
  type DocumentReference, type Transaction, type WriteBatch,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import { snapshot, type Collection, type HistoryAction } from './core/corpus'
import {
  bundle, emptyApp, emptyString, mergeImport, stringDocId,
  type AppData, type ImportFile, type MergePlan, type Status, type StringData,
} from './core/strings'

// App labels in Firestore (firestore.rules: app labels section). Every write adds one corpusHistory
// entry in the same batch or transaction (the document names it in historyId, as in the lexicon);
// every change to a fix also rewrites published/{app}, the corrections the app reads.

export type App = AppData & { id: string }

const PROJECT = import.meta.env.VITE_FB_PROJECT_ID ?? '<project>'
// Where an app reads its corrections without signing in (docs/API.md).
export const publishedUrl = (app: string) => `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/published/${app}`
export type Str = StringData & { id: string; updatedBy: string; updatedAt: number }

const me = () => (auth.currentUser?.email ?? '').toLowerCase()
const ms = (x: unknown) => (x && typeof (x as { toMillis?: () => number }).toMillis === 'function' ? (x as { toMillis: () => number }).toMillis() : 0)

export function fill<T extends object>(empty: T, x: Record<string, unknown>): T {
  const out = { ...empty } as Record<string, unknown>
  for (const [k, def] of Object.entries(empty)) {
    const v = x[k]
    if (Array.isArray(def)) out[k] = Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []
    else if (typeof v === typeof def) out[k] = v
  }
  return out as T
}
const STRING_FIELDS = Object.keys(emptyString('a', 'b')) as (keyof StringData)[]
const content = (s: StringData): StringData => Object.fromEntries(STRING_FIELDS.map((k) => [k, s[k]])) as unknown as StringData

/* ------------------------------------------------------------------ reading */

export function useApps(): App[] {
  const [list, setList] = useState<App[]>([])
  useEffect(
    () => onSnapshot(collection(db, 'apps'), (s) => setList(s.docs.map((d) => ({ ...fill(emptyApp(), d.data()), id: d.id })).sort((a, b) => a.name.localeCompare(b.name))), () => setList([])),
    [],
  )
  return list
}

// Every string of one app, live (another editor's fix shows at once).
export function useStrings(app: string | null): { list: Str[]; loading: boolean } {
  const [state, setState] = useState<{ app: string | null; list: Str[] }>({ app: null, list: [] })
  useEffect(() => {
    if (!app) return
    return onSnapshot(
      query(collection(db, 'strings'), where('app', '==', app)),
      (s) => setState({ app, list: s.docs.map((d) => ({ ...fill(emptyString(app, ''), d.data()), id: d.id, updatedBy: String(d.data().updatedBy ?? ''), updatedAt: ms(d.data().updatedAt) })) }),
      () => setState({ app, list: [] }),
    )
  }, [app])
  return { list: app && state.app === app ? state.list : [], loading: !!app && state.app !== app }
}

/* ------------------------------------------------------------------ writing */

// A batch or a transaction: both set() the same way.
export type Writer = WriteBatch | Transaction

// One document and its history entry. prev = the stored content (null when creating). The lexicon
// (src/lexicon.ts) writes through here too.
export function put(w: Writer, col: Collection | 'corpusStrings' | 'corpusApps', ref: DocumentReference, docId: string, data: object, prev: object | null, action: HistoryAction = prev ? 'update' : 'create') {
  const by = me()
  const now = serverTimestamp()
  const h = doc(collection(db, 'corpusHistory'))
  const b = w as WriteBatch
  b.set(h, { collection: col, docId, action, before: snapshot(prev), after: snapshot(data), by, at: now })
  if (prev) b.set(ref, { ...data, updatedBy: by, updatedAt: now, historyId: h.id }, { merge: true })
  else b.set(ref, { ...data, createdBy: by, createdAt: now, updatedBy: by, updatedAt: now, historyId: h.id })
}

export async function saveApp(id: string, d: AppData, prev: App | null) {
  const b = writeBatch(db)
  const data: AppData = { name: d.name.trim(), description: d.description.trim(), kind: d.kind, keyStyle: d.keyStyle, repo: d.repo.trim() }
  put(b, 'corpusApps', doc(db, 'apps', id), id, data, prev ? fill(emptyApp(), prev as unknown as Record<string, unknown>) : null)
  await b.commit()
}

export interface Review {
  status: Status
  fix: string
  notes?: string
}

// Mark a string checked, fix it, or send it back to new; the app's published corrections follow in
// the same transaction, so an app never sees a fix the corpus does not hold, or the other way round.
export async function review(s: Str, r: Review) {
  const ref = doc(db, 'strings', s.id)
  const pub = doc(db, 'published', s.app)
  await runTransaction(db, async (tx) => {
    const [cur, p] = await Promise.all([tx.get(ref), tx.get(pub)])
    if (!cur.exists()) throw new Error('This string is no longer in the corpus.')
    const before = content(fill(emptyString(s.app, s.key), cur.data()))
    const after: StringData = {
      ...before,
      status: r.status,
      fix: r.status === 'fixed' ? r.fix.trim() : '',
      notes: r.notes ?? before.notes,
      checkedBy: r.status === 'new' ? '' : me(),
    }
    put(tx, 'corpusStrings', ref, s.id, after, before)
    const entries = { ...((p.exists() ? p.data().entries : {}) as Record<string, string>) }
    if (after.status === 'fixed' && after.fix && !after.retired) entries[s.key] = after.fix
    else delete entries[s.key]
    tx.set(pub, { entries, count: Object.keys(entries).length, updatedBy: me(), updatedAt: serverTimestamp() })
  })
}

// Each batch holds a few strings with their history entries: the rules read each history entry
// (getAfter) and allow at most 20 document reads per batch.
const PER_BATCH = 12

export interface ImportResult extends Omit<MergePlan, 'create' | 'update'> {
  created: number
  updated: number
}

// Bring an app's export in (core/strings.ts mergeImport), then republish the app's corrections.
export async function importApp(file: ImportFile, onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  const appRef = doc(db, 'apps', file.app)
  if (!(await getDoc(appRef)).exists()) {
    await saveApp(file.app, { ...emptyApp(), name: file.name ?? file.app, keyStyle: file.keyStyle ?? 'keys' }, null)
  }
  const existing = (await getDocs(query(collection(db, 'strings'), where('app', '==', file.app)))).docs.map((d) => content(fill(emptyString(file.app, ''), d.data())))
  const plan = mergeImport(file, existing)
  const byKey = new Map(existing.map((s) => [s.key, s]))
  type Job = { key: string; data: StringData; prev: StringData | null }
  const jobs: Job[] = [
    ...plan.create.map((d) => ({ key: d.key, data: d, prev: null })),
    ...plan.update.map((u) => {
      const prev = byKey.get(u.key)!
      const data = { ...prev, ...u.fields }
      // A fix that has landed in the app's code: the importer records the change of status.
      if (plan.landed.includes(u.key)) data.checkedBy = me()
      return { key: u.key, data, prev }
    }),
    ...plan.retire.map((key) => ({ key, data: { ...byKey.get(key)!, retired: true }, prev: byKey.get(key)! })),
  ]
  let done = 0
  for (let i = 0; i < jobs.length; i += PER_BATCH) {
    const b = writeBatch(db)
    for (const j of jobs.slice(i, i + PER_BATCH)) put(b, 'corpusStrings', doc(db, 'strings', stringDocId(file.app, j.key)), stringDocId(file.app, j.key), j.data, j.prev)
    await b.commit()
    done = Math.min(jobs.length, i + PER_BATCH)
    onProgress?.(done, jobs.length)
  }
  await republish(file.app)
  return { created: plan.create.length, updated: plan.update.length, unchanged: plan.unchanged, landed: plan.landed, reopened: plan.reopened, retire: plan.retire }
}

// Rebuild published/{app} from the strings (after an import, or to repair it).
export async function republish(app: string) {
  const all = (await getDocs(query(collection(db, 'strings'), where('app', '==', app)))).docs.map((d) => content(fill(emptyString(app, ''), d.data())))
  const entries = bundle(all)
  const b = writeBatch(db)
  b.set(doc(db, 'published', app), { entries, count: Object.keys(entries).length, updatedBy: me(), updatedAt: serverTimestamp() })
  await b.commit()
}
