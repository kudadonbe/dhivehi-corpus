import { useEffect, useState } from 'react'
import { collection, getCountFromServer } from 'firebase/firestore'
import { db } from '../firebase'

// The lexicon (roots, words, dialect forms, sentences, sources) moved here from TaxiQ: the data, its
// rules and its model (src/core/corpus.ts) are in this repo. Its editor screens come from TaxiQ's
// CorpusView next (docs/ROADMAP.md); until then this shows what the corpus holds.
const PARTS: [string, string][] = [['corpusRoots', 'Roots'], ['corpusWords', 'Words'], ['corpusSentences', 'Sentences'], ['corpusSources', 'Sources'], ['corpusHistory', 'Changes recorded']]

export function Lexicon() {
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  useEffect(() => {
    let live = true
    for (const [col] of PARTS) {
      getCountFromServer(collection(db, col)).then((c) => live && setCounts((x) => ({ ...x, [col]: c.data().count }))).catch(() => live && setCounts((x) => ({ ...x, [col]: null })))
    }
    return () => { live = false }
  }, [])
  return (
    <section className="lexicon">
      <h2>Lexicon</h2>
      <p>Words grouped by root, each word's forms in the dialects (Malé, Addu, Huvadhu, Fuvahmulah, Naifaru), example sentences, and the sources behind them. Moved here from TaxiQ with its full history.</p>
      <dl className="counts">
        {PARTS.map(([col, label]) => (
          <div key={col}><dt>{label}</dt><dd>{counts[col] === undefined ? '…' : counts[col] === null ? '–' : counts[col]}</dd></div>
        ))}
      </dl>
      <p className="hint">The word editor moves here from TaxiQ next. Until then, edit words in TaxiQ's corpus editor before the move, or not at all after it.</p>
    </section>
  )
}
