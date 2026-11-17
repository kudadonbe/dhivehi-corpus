import { describe, expect, it } from 'vitest'
import { emptyRoot, emptyWord } from './corpus'
import { groupByRoot, historyValue, wordSortKey } from './lexicon'

const root = (id: string, thaana: string, extra = {}) => ({ ...emptyRoot(), id, thaana, ...extra })
const word = (id: string, rootId: string, extra = {}) => ({ ...emptyWord(), id, rootId, ...extra })

describe('word list by root', () => {
  const roots = [root('r2', 'ބޭސް', { latin: 'beys', meaningEn: 'medicine' }), root('r1', 'ކަނޑު', { latin: 'kandu' })]
  const words = [
    word('w1', 'r2', { thaana: 'ބޭސްފުޅު', latin: 'beysfulhu' }),
    word('w2', 'r2', { latin: 'aroshi' }),
    word('w3', '', { latin: 'laagulha', meaningEn: 'a seed' }),
    word('w4', 'gone', { latin: 'zz' }),
    word('w5', 'r1', { thaana: 'ކަނޑުމަތި', latin: 'kandumathi' }),
  ]

  it('groups every word under its root, in root order, rootless (and deleted-root) words last', () => {
    const g = groupByRoot(words, roots, '')
    expect(g.map((x) => x.root?.id ?? null)).toEqual(['r2', 'r1', null]) // ބ before ކ
    expect(g[0].words.map((w) => w.id)).toEqual(['w2', 'w1'])
    expect(g[2].words.map((w) => w.id)).toEqual(['w3', 'w4'])
  })
  it('leaves out roots without words', () => {
    expect(groupByRoot([words[2]], roots, '').map((x) => x.root)).toEqual([null])
  })
  it('finds words by Thaana with or without vowel signs, Latin and meaning', () => {
    expect(groupByRoot(words, roots, 'ކނޑމތ').flatMap((x) => x.words.map((w) => w.id))).toEqual(['w5'])
    expect(groupByRoot(words, roots, 'LAAGU').flatMap((x) => x.words.map((w) => w.id))).toEqual(['w3'])
    expect(groupByRoot(words, roots, 'seed').flatMap((x) => x.words.map((w) => w.id))).toEqual(['w3'])
  })
  it('shows all of a root\'s words when the root matches', () => {
    expect(groupByRoot(words, roots, 'medicine').flatMap((x) => x.words.map((w) => w.id))).toEqual(['w2', 'w1'])
  })
  it('searches dialect forms too', () => {
    const forms = new Map([['w2', [{ thaana: 'އަރޮށި', latin: '' }]]])
    expect(groupByRoot(words, roots, 'އަރޮށި', forms).flatMap((x) => x.words.map((w) => w.id))).toEqual(['w2'])
  })
  it('sorts a word by Latin, or Thaana when it has none', () => {
    expect(wordSortKey({ thaana: 'ބ', latin: '' })).toBe('ބ')
    expect(wordSortKey({ thaana: 'ބ', latin: 'b' })).toBe('b')
  })
})

describe('history values', () => {
  it('shows empty as a dash, lists joined, sources by title, long text cut', () => {
    expect(historyValue(null, 'notes')).toBe('–')
    expect(historyValue('', 'notes')).toBe('–')
    expect(historyValue([], 'sources')).toBe('–')
    expect(historyValue(['s1', 's2'], 'sources', (id) => (id === 's1' ? 'MFDA list' : undefined))).toBe('MFDA list, s2')
    expect(historyValue(['w1'], 'wordIds', () => 'never')).toBe('w1')
    expect(historyValue(true, 'verified')).toBe('true')
    expect(historyValue('x'.repeat(130), 'notes')).toBe(`${'x'.repeat(120)}…`)
  })
})
