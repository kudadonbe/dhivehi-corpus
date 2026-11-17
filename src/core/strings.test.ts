import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  bundle, checkFix, current, emptyApp, emptyString, exportFixes, mergeImport, normaliseText, parseImport, placeholders, progress,
  stringDocId, stringMatches, textKey, validateApp, type ImportFile, type StringData,
} from './strings'

const s = (key: string, x: Partial<StringData> = {}): StringData => ({ ...emptyString('fc-eforms', key), builtIn: 'ކުރިއަށް', ...x })
const file = (strings: ImportFile['strings']): ImportFile => ({ format: 'dhivehi-corpus/strings-1', app: 'fc-eforms', strings })

describe('keys', () => {
  it('normalises text the way every client must', () => {
    expect(normaliseText('  ފޯމު \n  ހުށަހަޅާ  ')).toBe('ފޯމު ހުށަހަޅާ')
  })
  it('keys inline text by SHA-256, the same as PHP and Go would', async () => {
    const text = 'ޓެސްޓު  ސައިޓެވެ.'
    const want = 't:' + createHash('sha256').update('ޓެސްޓު ސައިޓެވެ.', 'utf8').digest('hex').slice(0, 16)
    expect(await textKey(text)).toBe(want)
    expect(await textKey(' ޓެސްޓު ސައިޓެވެ. ')).toBe(want)
  })
  it('makes document ids Firestore accepts', () => {
    expect(stringDocId('taxiq', 'errors.taken')).toBe('taxiq~errors%2Etaken')
    expect(stringDocId('fc-eforms', 't:0123abcd')).toBe('fc-eforms~t%3A0123abcd')
    expect(stringDocId('x1', 'a/b')).not.toContain('/')
  })
})

describe('checking a fix', () => {
  it('accepts a different Dhivehi text with the same placeholders', () => {
    expect(checkFix('ކޯޑަކީ {code}', 'ތިބާގެ ކޯޑު {code}')).toBeNull()
    expect(checkFix('ޓެކްސީ {1} އަންނަނީ', 'ޓެކްސީ {1} އަންނަނީ.')).toBeNull()
  })
  it('refuses what would break the app or is no fix', () => {
    expect(checkFix('ކޯޑަކީ {code}', 'ތިބާގެ ކޯޑު')).toBe('placeholders')
    expect(checkFix('ކޯޑަކީ {code}', 'ކޯޑު {code} {ref}')).toBe('placeholders')
    expect(checkFix('ކުރިއަށް', '  ')).toBe('empty')
    expect(checkFix('ކުރިއަށް', 'Next')).toBe('not_thaana')
    expect(checkFix('ކުރިއަށް', ' ކުރިއަށް ')).toBe('same')
    expect(checkFix('ކުރިއަށް', 'ކ'.repeat(4001))).toBe('too_long')
  })
  it('lists placeholders of every style', () => {
    expect(placeholders('%s ގެ %d {1} {ref} %1$s')).toEqual(['%1$s', '%d', '%s', '{1}', '{ref}'])
  })
})

describe('apps', () => {
  it('needs a lower-case id and a name', () => {
    expect(validateApp('fc-eforms', { ...emptyApp(), name: 'eForms' })).toEqual({})
    expect(validateApp('FC_eforms', { ...emptyApp(), name: 'x' }).id).toBe('bad_value')
    expect(validateApp('taxiq', emptyApp()).name).toBe('required')
  })
})

describe('what an app shows', () => {
  it('shows a fix only once it is marked fixed', () => {
    expect(current(s('a', { fix: 'ކުރިއަށް ދާން', status: 'fixed' }))).toBe('ކުރިއަށް ދާން')
    expect(current(s('a', { fix: 'ކުރިއަށް ދާން', status: 'new' }))).toBe('ކުރިއަށް')
  })
  it('publishes only live fixes', () => {
    const list = [s('a', { status: 'fixed', fix: 'A' }), s('b', { status: 'checked' }), s('c', { status: 'fixed', fix: 'C', retired: true }), s('d')]
    expect(bundle(list)).toEqual({ a: 'A' })
    expect(exportFixes(list)).toEqual([{ key: 'a', where: [], en: '', before: 'ކުރިއަށް', after: 'A' }])
  })
  it('counts review progress without retired strings', () => {
    expect(progress([s('a'), s('b', { status: 'checked' }), s('c', { status: 'fixed', fix: 'x' }), s('d', { retired: true })])).toEqual({ total: 3, new: 1, checked: 1, fixed: 1 })
  })
  it('searches every visible field', () => {
    expect(stringMatches('render.php', s('a', { where: ['class-fc-eforms-render.php:12'] }))).toBe(true)
    expect(stringMatches('ކުރި', s('a'))).toBe(true)
    expect(stringMatches('nothing', s('a'))).toBe(false)
  })
})

describe('importing an app export', () => {
  it('refuses a file that is not an export', () => {
    expect(parseImport(null).problems.length).toBeGreaterThan(0)
    const bad = parseImport({ format: 'dhivehi-corpus/strings-1', app: 'Bad App', strings: [{ key: 'a', dv: 'Next' }, { key: 'a', dv: 'ކުރިއަށް' }] })
    expect(bad.file).toBeNull()
    expect(bad.problems.join(' ')).toMatch(/app must be/)
    expect(bad.problems.join(' ')).toMatch(/dv must be Dhivehi/)
    expect(bad.problems.join(' ')).toMatch(/appears twice/)
  })
  it('accepts a good one', () => {
    expect(parseImport(file([{ key: 'next', dv: 'ކުރިއަށް', en: 'Next' }])).file?.strings).toHaveLength(1)
  })
  it('creates new strings and leaves unchanged ones alone', () => {
    const p = mergeImport(file([{ key: 'a', dv: 'ކުރިއަށް' }, { key: 'b', dv: 'ފަހަތަށް', en: 'Back', where: ['x.php:1'] }]), [s('a')])
    expect(p.unchanged).toBe(1)
    expect(p.create).toHaveLength(1)
    expect(p.create[0]).toMatchObject({ app: 'fc-eforms', key: 'b', builtIn: 'ފަހަތަށް', en: 'Back', where: ['x.php:1'], status: 'new' })
  })
  it('keeps a fix until the app ships it, then retires it', () => {
    const fixed = s('a', { status: 'fixed', fix: 'ކުރިއަށް ދާން', checkedBy: 'kd' })
    expect(mergeImport(file([{ key: 'a', dv: 'ކުރިއަށް' }]), [fixed]).unchanged).toBe(1)
    const p = mergeImport(file([{ key: 'a', dv: 'ކުރިއަށް  ދާން' }]), [fixed])
    expect(p.landed).toEqual(['a'])
    expect(p.update[0]!.fields).toMatchObject({ status: 'checked', fix: '', builtIn: 'ކުރިއަށް  ދާން' })
  })
  it('sends a checked string back to review when the app changes its text', () => {
    const p = mergeImport(file([{ key: 'a', dv: 'އައު ލިޔުން' }]), [s('a', { status: 'checked', checkedBy: 'kd' })])
    expect(p.reopened).toEqual(['a'])
    expect(p.update[0]!.fields).toMatchObject({ status: 'new', checkedBy: '' })
  })
  it('retires strings the app no longer has, and brings them back if it does again', () => {
    expect(mergeImport(file([]), [s('a'), s('b', { retired: true })]).retire).toEqual(['a'])
    expect(mergeImport(file([{ key: 'b', dv: 'ކުރިއަށް' }]), [s('b', { retired: true })]).update[0]!.fields).toEqual({ retired: false })
  })
})
