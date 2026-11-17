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
pnpm test      # vitest: the lexicon model (from TaxiQ), the labels model, the eForms seed file
pnpm build     # tsc -b, then vite build to dist/
pnpm lint      # oxlint
```

| Path | |
|---|---|
| `src/core/corpus.ts` | Lexicon model: shapes, checks, search, export (TaxiQ v2.17.0, unchanged) |
| `src/core/strings.ts` | App labels: keys, checks on a correction, import merge, published bundle |
| `src/strings.ts` | Labels in Firestore: live lists, review (with history and publish in one transaction), import |
| `src/components/` | The site: Labels (review), Apps (connect, import, export), Lexicon, Editors |
| `firestore.rules` | Who may read and write what; every edit leaves an append-only history entry |
| `scripts/` | `export-fc-eforms.py`, `migrate-taxiq.mjs`, `build-rules.py` |
| `seed/` | Import files (`fc-eforms.json`); `taxiq-fixes.json` after the migration |

Fonts: MV Bodu and Dhanbumaa as in TaxiQ (from `kudadonbe.v3`), Noto Sans Thaana behind them.
