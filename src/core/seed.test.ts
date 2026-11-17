import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseImport, textKey } from './strings'

// The first import file (scripts/export-fc-eforms.py) must pass the corpus's own check, and its keys
// must be the textKey() every client computes.
describe('seed/fc-eforms.json', () => {
  const raw = JSON.parse(readFileSync(new URL('../../seed/fc-eforms.json', import.meta.url), 'utf8'))
  it('is a valid import', () => {
    const { file, problems } = parseImport(raw)
    expect(problems).toEqual([])
    expect(file!.strings.length).toBeGreaterThan(1000)
  })
  it('keys each string by its text, as the plugin will', async () => {
    for (const s of raw.strings.slice(0, 50)) expect(await textKey(s.dv)).toBe(s.key)
  })
  it('holds the test banner wording to be corrected', () => {
    const hit = raw.strings.filter((s: { dv: string }) => s.dv.includes('ޓެސްޓު ސައިޓެވެ'))
    expect(hit.length).toBe(1)
    expect(hit[0].where[0]).toMatch(/class-fc-eforms-seed\.php:\d+/)
    expect(hit[0].context).toMatch(/HTML/)
  })
})
