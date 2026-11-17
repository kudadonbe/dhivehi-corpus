// Pure helpers of the lexicon editor (src/components/Lexicon.tsx) that src/core/corpus.ts, kept as in
// TaxiQ v2.17.0, does not have: the word list grouped by root, and history values as text.
import { matches, wordMatches, type FormData, type RootData, type WordData } from './corpus'

type RootLike = Pick<RootData, 'thaana' | 'latin' | 'meaningEn' | 'meaningDv'> & { id: string }
type WordLike = Pick<WordData, 'thaana' | 'latin' | 'rootId' | 'meaningEn' | 'meaningDv' | 'scientificName'> & { id: string }

export interface RootGroup<R, W> {
  root: R | null // null: words with no root, or whose root was deleted
  words: W[]
}

// A word's place in a list: its Latin spelling, or its Thaana for a word without one.
export const wordSortKey = (w: Pick<WordData, 'thaana' | 'latin'>) => w.latin || w.thaana

// Words grouped by root for the word list. A word shows when it matches the search (core matches:
// Thaana with or without vowel signs, Latin, meanings, its dialect forms); every word of a root shows
// when the root itself matches. Groups in root order (Thaana), the words without a root last.
export function groupByRoot<R extends RootLike, W extends WordLike>(
  words: readonly W[],
  roots: readonly R[],
  query: string,
  forms: ReadonlyMap<string, readonly Pick<FormData, 'thaana' | 'latin'>[]> = new Map(),
): RootGroup<R, W>[] {
  const byId = new Map(roots.map((r) => [r.id, r]))
  const buckets = new Map<string, W[]>() // '' = no root
  for (const w of words) {
    const root = byId.get(w.rootId)
    const key = root ? root.id : ''
    const rootHit = !!root && !!query.trim() && matches(query, [root.thaana, root.latin, root.meaningEn, root.meaningDv])
    if (!rootHit && !wordMatches(query, w, forms.get(w.id) ?? [])) continue
    buckets.set(key, [...(buckets.get(key) ?? []), w])
  }
  const sortWords = (list: W[]) => [...list].sort((a, b) => wordSortKey(a).localeCompare(wordSortKey(b)))
  const out: RootGroup<R, W>[] = [...buckets.entries()]
    .filter(([key]) => key !== '')
    .map(([key, list]) => ({ root: byId.get(key)!, words: sortWords(list) }))
    .sort((a, b) => a.root!.thaana.localeCompare(b.root!.thaana) || a.root!.id.localeCompare(b.root!.id))
  const loose = buckets.get('')
  if (loose) out.push({ root: null, words: sortWords(loose) })
  return out
}

// A field's value in a history entry, as short text: lists joined (sources by their title), long
// text cut at 120 characters, empty as a dash.
export function historyValue(v: unknown, field: string, sourceTitle: (id: string) => string | undefined = () => undefined): string {
  if (v === null || v === undefined || v === '') return '–'
  if (Array.isArray(v)) return v.map((x) => (field === 'sources' ? (sourceTitle(String(x)) ?? String(x)) : String(x))).join(', ') || '–'
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return s.length > 120 ? `${s.slice(0, 120)}…` : s
}
