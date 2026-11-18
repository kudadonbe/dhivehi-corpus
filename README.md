# Dhivehi corpus

One home for the Dhivehi language as our apps use it:

- **The lexicon**: words grouped by root, each word's forms in the dialects (Malé, Addu, Huvadhu,
  Fuvahmulah, Naifaru), example sentences, and the sources behind them. The owner's own research,
  moved here from TaxiQ with its history. Nothing copied from Radheef or any other dictionary.
- **App labels**: every Dhivehi string every connected app shows (the eForms website, TaxiQ,
  Aailaa, Madhoshi, fc-api), reviewed in one place. A correction saved here reaches the app at once.

```
  editors ──► corpus site (this repo) ──► Firestore: kd-dhivehi-corpus
                                             │  published/{app}  (public, read-only)
          ┌──────────────────┬───────────────┼─────────────────┬──────────────┐
          ▼                  ▼               ▼                 ▼              ▼
   TaxiQ (live)       Aailaa (live)   eForms website     Madhoshi        fc-api
   listener           listener        HTTPS, 60 s cache  HTTPS, cache    HTTPS, cache
```

Every app keeps its built-in text and shows a correction instead when there is one. If the corpus
cannot be reached, the app shows its built-in text: nothing ever waits on the corpus.

## Open project

The corpus is public and everyone is welcome to contribute: see [CONTRIBUTING.md](CONTRIBUTING.md).
Data: [CC BY-SA 4.0](DATA-LICENSE.md). Code: [MIT](LICENSE).

## Docs

| | |
|---|---|
| [docs/API.md](docs/API.md) | How an app connects: keys, real-time and HTTPS reading, import and export formats |
| [docs/SETUP.md](docs/SETUP.md) | Creating the Firebase project, the first admin, deploying |
| [docs/MIGRATION.md](docs/MIGRATION.md) | Moving TaxiQ's corpus here |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What is built, what is next, what was decided |

## Develop

```sh
pnpm install
pnpm dev       # http://localhost:5173 (needs .env.local, docs/SETUP.md)
pnpm test      # vitest: the lexicon model (from TaxiQ) and editor helpers, the labels model, the eForms seed file
pnpm build     # tsc -b, then vite build to dist/
pnpm lint      # oxlint
```

| Path | |
|---|---|
| `src/core/corpus.ts` | Lexicon model: shapes, checks, search, export (TaxiQ v2.17.0, unchanged) |
| `src/core/lexicon.ts` | Lexicon editor helpers: the word list grouped by root, history values as text |
| `src/core/strings.ts` | App labels: keys, checks on a correction, import merge, published bundle |
| `src/strings.ts` | Labels in Firestore: live lists, review (with history and publish in one transaction), import; `put()`, the one write-with-history |
| `src/lexicon.ts` | Lexicon in Firestore (from TaxiQ's `src/corpus.ts`): live lists, save, verify, delete, export, each with its history entry |
| `src/components/` | The site: Labels (review), Apps (connect, import, export), Lexicon (words by root, dialect forms, sentences, roots, sources, history, verify, export), Editors |
| `firestore.rules` | Who may read and write what; every edit leaves an append-only history entry |
| `scripts/` | `export-fc-eforms.py`, `migrate-taxiq.mjs`, `build-rules.py` |
| `seed/` | Import files (`fc-eforms.json`); `taxiq-fixes.json` after the migration |

Fonts: MV Bodu and Dhanbumaa as in TaxiQ (from `kudadonbe.v3`), Noto Sans Thaana behind them.
