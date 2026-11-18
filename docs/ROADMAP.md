# Roadmap

| # | Slice | State |
|---|---|---|
| 1 | Repo, model, rules, tests; app-labels review site (review, correct, import, export, editors) | **Built 2026-11-17**, not yet deployed (needs the Firebase project, docs/SETUP.md) |
| 2 | eForms export (`scripts/export-fc-eforms.py`, `seed/fc-eforms.json`, 1,110 strings) | **Built** |
| 3 | TaxiQ lexicon data move (`scripts/migrate-taxiq.mjs`) | **Built**, to run by the owner (docs/MIGRATION.md) |
| 4 | Lexicon editor screens: port TaxiQ's `CorpusView` (word list by root, dialect forms, sentences, sources, history, verify, export) | **Built 2026-11-17**, not yet deployed (`src/lexicon.ts`, `src/components/Lexicon.tsx`; same collections and rules as TaxiQ, no rules change). Left out: TaxiQ's "start with the medicine words" seed (the migration brings those words) |
| 5 | fc-eforms reads corrections: `FC_EForms_Text` (key by text, `published/fc-eforms` over HTTPS, 60 s cache, built-in text on any failure); every inline Dhivehi literal through it; the export script moves into the plugin as `tools/export-dv.py` | Next |
| 6 | TaxiQ as a client: export script for `src/i18n.tsx` (keys style), its pencil editor writes here, `applyOverrides` fed from `published/taxiq`; corpus screens and collections leave TaxiQ; apply `seed/taxiq-fixes.json` | After 4 |
| 7 | Aailaa (`project-docs/translation-dhivehi.json`, 804 entries, keys style), Madhoshi (Go: SMS page Dhivehi, `sms_text.go` …), fc-api | After 5 |
| 8 | Links between labels and the lexicon (`wordIds` on a string; "this label uses ބަސް") and a glossary of court terms every app follows | Later |
| 9 | **Public project** (decided 2026-11-18): repo public, data CC BY-SA 4.0, code MIT; anyone reads the lexicon; anyone signed in suggests words, forms, sentences and label corrections; editors review and publish | Next |

## Decided (project lead, 2026-11-17)

- One corpus for all apps, in its own repo and interface; apps connect through the API and get
  corrections in real time.
- Its own Firebase project (not TaxiQ's `kd-taxiq`, not the court's `aqd-fc`).
- TaxiQ's corpus moves out; TaxiQ becomes a client.
- Repo name `dhivehi-corpus`.
- **The corpus is a public project** (2026-11-18): everyone welcome to contribute; data CC BY-SA 4.0, code MIT; hosted on Firebase (project `kd-dhivehi-corpus`) until the owner's VPS, then moved there.
