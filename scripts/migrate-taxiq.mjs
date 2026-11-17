// Move TaxiQ's Dhivehi corpus into this project (docs/MIGRATION.md).
//
//   node scripts/migrate-taxiq.mjs --from <kd-taxiq service-account.json> --to <corpus service-account.json> [--write]
//
// Without --write it only reads both sides and reports what it would copy. With --write it copies,
// keeping every document id, field and timestamp (createdAt/updatedAt/at stay as they were), then
// counts both sides again. It never deletes or changes anything in TaxiQ. Run it again safely: a
// document already copied is written with the same content.
//
// Copied: corpusRoots, corpusWords (+ each word's forms), corpusSentences, corpusSources,
// corpusHistory. TaxiQ's live label fixes (translations/dv) are saved to seed/taxiq-fixes.json, to
// apply once TaxiQ's own strings are imported as app "taxiq" (they need its built-in text first).
//
// The service-account files are secrets: keep them outside the repo (or in secrets/, which git
// ignores), and delete them when the move is done.
import { readFileSync, writeFileSync } from 'node:fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const from = opt('--from')
const to = opt('--to')
const write = args.includes('--write')
if (!from || !to) {
  console.error('usage: node scripts/migrate-taxiq.mjs --from <taxiq key.json> --to <corpus key.json> [--write]')
  process.exit(2)
}

const load = (path) => JSON.parse(readFileSync(path, 'utf8'))
const src = getFirestore(initializeApp({ credential: cert(load(from)) }, 'taxiq'))
const dst = getFirestore(initializeApp({ credential: cert(load(to)) }, 'corpus'))
const srcProject = load(from).project_id
const dstProject = load(to).project_id
if (srcProject === dstProject) {
  console.error('--from and --to are the same project; stopping.')
  process.exit(2)
}
console.log(`from ${srcProject} to ${dstProject}${write ? '' : '  (dry run: add --write to copy)'}`)

const TOP = ['corpusRoots', 'corpusWords', 'corpusSentences', 'corpusSources', 'corpusHistory']

async function copyDocs(docs, refFor) {
  let n = 0
  for (let i = 0; i < docs.length; i += 400) {
    const b = dst.batch()
    for (const d of docs.slice(i, i + 400)) b.set(refFor(d), d.data())
    if (write) await b.commit()
    n += Math.min(400, docs.length - i)
  }
  return n
}

const report = {}
for (const col of TOP) {
  const docs = (await src.collection(col).get()).docs
  report[col] = await copyDocs(docs, (d) => dst.collection(col).doc(d.id))
  if (col === 'corpusWords') {
    let forms = 0
    for (const w of docs) {
      const fd = (await w.ref.collection('forms').get()).docs
      forms += await copyDocs(fd, (d) => dst.collection('corpusWords').doc(w.id).collection('forms').doc(d.id))
    }
    report['corpusWords/*/forms'] = forms
  }
}

const tr = await src.collection('translations').doc('dv').get()
const entries = tr.exists ? tr.data().entries ?? {} : {}
writeFileSync(new URL('../seed/taxiq-fixes.json', import.meta.url), JSON.stringify({ format: 'dhivehi-corpus/fixes-taxiq-1', from: srcProject, savedAt: new Date().toISOString(), entries }, null, 1) + '\n')
report['translations/dv (to seed/taxiq-fixes.json)'] = Object.keys(entries).length

console.table(report)
if (write) {
  const check = {}
  for (const col of TOP) {
    const [a, b] = await Promise.all([src.collection(col).count().get(), dst.collection(col).count().get()])
    check[col] = { taxiq: a.data().count, corpus: b.data().count, same: a.data().count === b.data().count }
  }
  console.table(check)
}
