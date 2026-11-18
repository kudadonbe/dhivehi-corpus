# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Dhivehi corpus: the lexicon (moved from TaxiQ) and every connected app's Dhivehi labels, with
their review and corrections, in Firebase project `kd-dhivehi-corpus`. Apps read corrections from
`published/{app}` (docs/API.md). Read README.md and docs/ROADMAP.md first. The project is public:
data CC BY-SA 4.0, code MIT (CONTRIBUTING.md).

## Commands

```sh
pnpm dev                                   # vite on :5173; needs .env.local (docs/SETUP.md), else the site shows "Not set up yet"
pnpm test                                  # vitest run, all tests
pnpm vitest run src/core/strings.test.ts   # one file
pnpm vitest run -t "SHA-256"               # tests whose name matches
pnpm build                                 # tsc -b + vite build: the type-check gate
pnpm lint                                  # oxlint
pnpm deploy | pnpm rules | pnpm release    # hosting | rules+indexes | both (firebase CLI)
```

PRs need `pnpm test`, `pnpm build` and `pnpm lint` passing.

## Architecture

One-page React 19 + Vite + Tailwind 4 site, no router (`src/App.tsx` switches tabs: App labels,
Apps, Lexicon, Editors). Google sign-in; access is `editors/{email}` in Firestore (`src/auth.tsx`).

Two layers, kept apart:

- **`src/core/`: pure model, no Firebase.** Shapes, validation, merge and bundle logic, all unit
  tested. `corpus.ts` is the lexicon model (TaxiQ v2.17.0), `strings.ts` the app-labels model
  (`textKey`, import parsing, `mergeImport`, `bundle`), `lexicon.ts` editor helpers. Put new logic
  here so it can be tested without Firestore.
- **`src/strings.ts`, `src/lexicon.ts`: the Firestore layer.** Live `onSnapshot` hooks and writes.
  `put()` in `src/strings.ts` is the single write-with-history used by both labels and lexicon.

Firestore collections: lexicon `corpusRoots`, `corpusWords` (+ `forms/{dialect}` subcollection),
`corpusSentences`, `corpusSources`; labels `apps`, `strings` (doc id from `stringDocId(app, key)`);
`published/{app}` (public, `{entries: {key: fix}, count}`); `corpusHistory` (append-only). History
entries name labels as `corpusApps`/`corpusStrings` even though the docs live in `apps`/`strings`.

Label flow: an app's export (import format, docs/API.md) → `importApp` merges into `strings` in
batches → `republish` rebuilds `published/{app}`. A review (`review()`) updates the string and
`published/{app}` in one transaction so they never disagree. Apps are "keys" style (their own
keys) or "text" style (key = `textKey(text)`, computed identically in PHP/Go clients).

`firestore.rules` is edited directly. `scripts/build-rules.py` (+ `rules-head/tail.txt`) only
records how the lexicon section was lifted from TaxiQ; do not re-run it.

Scripts: `export-fc-eforms.py` produces `seed/fc-eforms.json` (checked by `src/core/seed.test.ts`);
`migrate-taxiq.mjs` copies TaxiQ's corpus with firebase-admin (dry run unless `--write`; takes
service-account files, docs/MIGRATION.md).

## Rules

- **The contract is docs/API.md.** Key computation (`textKey`), the `published/{app}` shape and the
  import format are used by other repos (fc-eforms PHP, Go apps, TaxiQ). Change them only with a
  version bump of the format name and every client updated.
- **The lexicon model is TaxiQ's.** `src/core/corpus.ts` and the lexicon section of
  `firestore.rules` match TaxiQ v2.17.0 so its data moves unchanged. Change both together, with tests.
- **Every write leaves history.** Any new write path puts the document and a `corpusHistory` entry in
  one batch or transaction (`put()` in `src/strings.ts`), and the rules check it (`corpusLogged`).
  Mind the rules' limit of 20 document reads per batch (`PER_BATCH`).
- **No personal data.** Speaker labels are short ("elder, Hithadhoo"), never names or numbers; labels
  are app wording. Service-account keys never enter the repo (`secrets/` is ignored).
- **Never print secrets** (service-account JSON, `.env.local` values) in output or logs.
- The rules have no emulator test here (no Java on the lead's PC): deploying them compiles them.
- Commits: short imperative summaries.
