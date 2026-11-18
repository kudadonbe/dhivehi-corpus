import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hasThaana, parseImport, placeholders } from '../core/strings'
import { UI } from './text'

// The site's own wording is an app in the corpus. seed/dhivehi-corpus.json is its import file, made
// from src/ui/text.ts: after changing the table, run
//   UPDATE_SEED=1 pnpm vitest run src/ui
// and import the file on the Apps page.

const SEED = new URL('../../seed/dhivehi-corpus.json', import.meta.url)

function importFile() {
  return {
    format: 'dhivehi-corpus/strings-1',
    app: 'dhivehi-corpus',
    name: 'Dhivehi corpus (this site)',
    keyStyle: 'keys',
    strings: Object.entries(UI).map(([key, [dv, en]]) => ({ key, dv, en, group: key.split('.')[0], where: ['src/ui/text.ts'] })),
  }
}

describe('the site wording', () => {
  it('is Dhivehi, with the same placeholders as the English', () => {
    for (const [key, [dv, en]] of Object.entries(UI)) {
      expect(hasThaana(dv), key).toBe(true)
      expect(placeholders(dv), key).toEqual(placeholders(en))
    }
  })

  it('is a valid import file, and seed/dhivehi-corpus.json is up to date', () => {
    const file = importFile()
    expect(parseImport(file).problems).toEqual([])
    const body = JSON.stringify(file, null, 2) + '\n'
    if (process.env.UPDATE_SEED) writeFileSync(SEED, body, 'utf8')
    expect(readFileSync(SEED, 'utf8').replace(/
/g, '
')).toBe(body) // a Windows checkout may have CRLF
  })
})
