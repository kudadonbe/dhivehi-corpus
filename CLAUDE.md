# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

The Dhivehi corpus: the lexicon (moved from TaxiQ) and every connected app's Dhivehi labels, with
their review and corrections, in Firebase project `kd-dhivehi-corpus`. Apps read corrections from
`published/{app}` (docs/API.md). Read README.md and docs/ROADMAP.md first.

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
- Tests: `pnpm test` (vitest); `pnpm build` is the type-check gate. The rules have no emulator test
  here (no Java on the lead's PC): deploying them compiles them.
- Commits: short imperative summaries.
