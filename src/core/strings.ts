// App labels: every Dhivehi string every connected app shows, in one place, with its corrections.
// Pure parts only (shapes, keys, checks, import merge, bundles); Firestore reads and writes are in
// src/strings.ts, and firestore.rules (strings section) checks the same shapes.
//
// How an app is connected (docs/API.md):
// 1. The app exports its built-in strings (key, English, Dhivehi, where used) and an editor imports
//    them here (Import). Apps whose Dhivehi is written inline in the code have no keys: their key is
//    textKey(the built-in text), which the app computes the same way at run time.
// 2. Editors review each string: "checked" (the built-in is right) or "fixed" (a correction).
// 3. Every fix goes at once into published/{app}: { entries: { key: corrected text } }. Web apps
//    listen to that one document (real time); server apps read it over HTTPS with a short cache.
// 4. The app shows the correction instead of its built-in text. Fixes are later written back into
//    the app's code (Export); on the next import the fix is seen as landed and is retired.

export const APP_KINDS = ['web', 'server', 'desktop', 'mobile', 'other'] as const
export type AppKind = (typeof APP_KINDS)[number]
// keys: the app has symbolic keys ('errors.taken'); text: Dhivehi inline in code, keyed by textKey().
export const KEY_STYLES = ['keys', 'text'] as const
export type KeyStyle = (typeof KEY_STYLES)[number]
export const STATUSES = ['new', 'checked', 'fixed'] as const
export type Status = (typeof STATUSES)[number]

export const STRING_LIMITS = {
  appName: 80,
  description: 300,
  repo: 200,
  key: 200,
  text: 4000, // form wording can be a long paragraph
  context: 300,
  where: 40, // places listed for one string
  whereItem: 160,
  group: 80,
  notes: 1000,
  strings: 5000, // per app
} as const

export const APP_ID = /^[a-z0-9][a-z0-9-]{1,39}$/

export interface AppData {
  name: string
  description: string
  kind: AppKind
  keyStyle: KeyStyle
  repo: string // e.g. 'kudadonbe/TaxiQ' (where fixes are written back)
}

export interface StringData {
  app: string
  key: string
  en: string // English, where the app has it ('' when Dhivehi only)
  builtIn: string // the Dhivehi the app ships
  fix: string // the correction ('' = none)
  status: Status // new: not reviewed; checked: the built-in is right; fixed: fix replaces it
  context: string // what the reader sees it as, e.g. 'button', 'error under a field', 'SMS'
  where: string[] // file:line or screen names, from the app's export
  group: string // e.g. 'ui', 'sms', 'form:Fm-C-B20'
  wordIds: string[] // lexicon words this text uses (corpusWords ids)
  notes: string
  checkedBy: string // who marked it checked or fixed it
  retired: boolean // no longer in the app's latest export
}

export const emptyApp = (): AppData => ({ name: '', description: '', kind: 'web', keyStyle: 'keys', repo: '' })
export const emptyString = (app: string, key: string): StringData => ({
  app, key, en: '', builtIn: '', fix: '', status: 'new', context: '', where: [], group: '', wordIds: [], notes: '', checkedBy: '', retired: false,
})

/* ------------------------------------------------------------------ keys */

// The text an inline-text app is keyed by: trimmed, inner whitespace as one space, Unicode NFC.
export function normaliseText(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim()
}

// 't:' + the first 16 hex digits of SHA-256(UTF-8 of normaliseText(text)). Every client computes the
// same: PHP  't:' . substr(hash('sha256', $norm), 0, 16);  Go  hex of sha256.Sum256 cut to 16.
export async function textKey(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(normaliseText(text))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return 't:' + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// Firestore document id of a string: app~key, with characters a document id cannot hold escaped.
export function stringDocId(app: string, key: string): string {
  return app + '~' + encodeURIComponent(key).replace(/\./g, '%2E')
}

/* ------------------------------------------------------------------ checks */

const TH = /[ހ-޿]/
export const hasThaana = (s: string) => TH.test(s)

// Placeholders an app fills in: {1}, {code}, {ref}, %s, %d, %1$s.
const PLACEHOLDER = /\{[A-Za-z0-9_]+\}|%(?:\d+\$)?[sd]/g
export function placeholders(s: string): string[] {
  return [...s.matchAll(PLACEHOLDER)].map((m) => m[0]).sort()
}

export type FixProblem = 'empty' | 'too_long' | 'not_thaana' | 'placeholders' | 'same'

// A correction must be Dhivehi, not empty, within the limit, keep exactly the placeholders of the
// built-in text, and differ from it (otherwise it is "checked", not a fix).
export function checkFix(builtIn: string, fix: string): FixProblem | null {
  const t = fix.trim()
  if (!t) return 'empty'
  if (t.length > STRING_LIMITS.text) return 'too_long'
  if (hasThaana(builtIn) && !hasThaana(t)) return 'not_thaana'
  if (placeholders(builtIn).join('|') !== placeholders(t).join('|')) return 'placeholders'
  if (normaliseText(t) === normaliseText(builtIn)) return 'same'
  return null
}

export function validateApp(id: string, d: AppData): Partial<Record<keyof AppData | 'id', string>> {
  const e: Partial<Record<keyof AppData | 'id', string>> = {}
  if (!APP_ID.test(id)) e.id = 'bad_value'
  if (!d.name.trim()) e.name = 'required'
  else if (d.name.length > STRING_LIMITS.appName) e.name = 'too_long'
  if (d.description.length > STRING_LIMITS.description) e.description = 'too_long'
  if (!(APP_KINDS as readonly string[]).includes(d.kind)) e.kind = 'bad_value'
  if (!(KEY_STYLES as readonly string[]).includes(d.keyStyle)) e.keyStyle = 'bad_value'
  if (d.repo.length > STRING_LIMITS.repo) e.repo = 'too_long'
  return e
}

/* ------------------------------------------------------------------ the text an app shows */

// What the app should show for a string now.
export const current = (s: Pick<StringData, 'builtIn' | 'fix' | 'status'>) => (s.status === 'fixed' && s.fix ? s.fix : s.builtIn)

// published/{app}.entries: only the corrections (the app has its built-in text for the rest).
export function bundle(strings: readonly StringData[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of strings) {
    if (s.status === 'fixed' && s.fix && !s.retired) out[s.key] = s.fix
  }
  return out
}

// Corrections to write back into an app's code, as before → after pairs.
export function exportFixes(strings: readonly StringData[]) {
  return strings
    .filter((s) => s.status === 'fixed' && s.fix && !s.retired)
    .map((s) => ({ key: s.key, where: s.where, en: s.en, before: s.builtIn, after: s.fix }))
}

/* ------------------------------------------------------------------ import */

// What an app's export holds (docs/API.md, "Import format").
export interface ImportFile {
  format: 'dhivehi-corpus/strings-1'
  app: string
  name?: string
  keyStyle?: KeyStyle
  strings: ImportString[]
}
export interface ImportString {
  key: string
  dv: string
  en?: string
  context?: string
  where?: string[]
  group?: string
}

export function parseImport(raw: unknown): { file: ImportFile | null; problems: string[] } {
  const problems: string[] = []
  const x = raw as Partial<ImportFile> | null
  if (!x || typeof x !== 'object') return { file: null, problems: ['not a JSON object'] }
  if (x.format !== 'dhivehi-corpus/strings-1') problems.push('format must be "dhivehi-corpus/strings-1"')
  if (typeof x.app !== 'string' || !APP_ID.test(x.app)) problems.push('app must be a lower-case id like "fc-eforms"')
  if (!Array.isArray(x.strings)) return { file: null, problems: [...problems, 'strings must be a list'] }
  if (x.strings.length > STRING_LIMITS.strings) problems.push(`more than ${STRING_LIMITS.strings} strings`)
  const seen = new Set<string>()
  x.strings.forEach((s, i) => {
    if (!s || typeof s.key !== 'string' || !s.key || s.key.length > STRING_LIMITS.key) problems.push(`string ${i + 1}: key missing or too long`)
    else if (seen.has(s.key)) problems.push(`string ${i + 1}: key "${s.key}" appears twice`)
    else seen.add(s.key)
    if (!s || typeof s.dv !== 'string' || !hasThaana(s.dv)) problems.push(`string ${i + 1}: dv must be Dhivehi text`)
    else if (s.dv.length > STRING_LIMITS.text) problems.push(`string ${i + 1}: dv too long`)
  })
  return problems.length ? { file: null, problems } : { file: x as ImportFile, problems }
}

export interface MergePlan {
  create: StringData[]
  update: { key: string; fields: Partial<StringData> }[]
  unchanged: number
  landed: string[] // keys whose fix is now the app's built-in text (written back): fix retired
  reopened: string[] // keys whose built-in text changed under a "checked": back to new
  retire: string[] // keys no longer in the export
}

// Merge an app's export into what the corpus holds. Never loses an editor's work: a fix stays until
// the app ships it; a changed built-in text under "checked" goes back to "new" to be looked at again.
export function mergeImport(file: ImportFile, existing: readonly StringData[]): MergePlan {
  const have = new Map(existing.map((s) => [s.key, s]))
  const plan: MergePlan = { create: [], update: [], unchanged: 0, landed: [], reopened: [], retire: [] }
  const seen = new Set<string>()
  for (const s of file.strings) {
    seen.add(s.key)
    const where = (s.where ?? []).slice(0, STRING_LIMITS.where).map((w) => String(w).slice(0, STRING_LIMITS.whereItem))
    const incoming = { en: s.en ?? '', builtIn: s.dv, context: (s.context ?? '').slice(0, STRING_LIMITS.context), where, group: (s.group ?? '').slice(0, STRING_LIMITS.group) }
    const old = have.get(s.key)
    if (!old) {
      plan.create.push({ ...emptyString(file.app, s.key), ...incoming })
      continue
    }
    const fields: Partial<StringData> = {}
    for (const k of ['en', 'context', 'group'] as const) if (old[k] !== incoming[k]) fields[k] = incoming[k]
    if (old.where.join('\n') !== where.join('\n')) fields.where = where
    if (old.retired) fields.retired = false
    if (normaliseText(old.builtIn) !== normaliseText(incoming.builtIn)) {
      fields.builtIn = incoming.builtIn
      if (old.status === 'fixed' && normaliseText(old.fix) === normaliseText(incoming.builtIn)) {
        fields.status = 'checked'
        fields.fix = ''
        plan.landed.push(s.key)
      } else if (old.status === 'checked') {
        fields.status = 'new'
        fields.checkedBy = ''
        plan.reopened.push(s.key)
      }
    }
    if (Object.keys(fields).length) plan.update.push({ key: s.key, fields })
    else plan.unchanged++
  }
  for (const s of existing) if (!seen.has(s.key) && !s.retired) plan.retire.push(s.key)
  return plan
}

/* ------------------------------------------------------------------ review progress */

export function progress(strings: readonly StringData[]) {
  const live = strings.filter((s) => !s.retired)
  const n = (st: Status) => live.filter((s) => s.status === st).length
  return { total: live.length, new: n('new'), checked: n('checked'), fixed: n('fixed') }
}

export function stringMatches(q: string, s: StringData): boolean {
  const t = normaliseText(q).toLowerCase()
  if (!t) return true
  return [s.key, s.en, s.builtIn, s.fix, s.context, s.group, s.notes, ...s.where].some((f) => f.toLowerCase().includes(t))
}
