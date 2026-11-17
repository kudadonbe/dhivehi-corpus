# Moving TaxiQ's corpus here

TaxiQ (v2.17.0, project `kd-taxiq`) holds the lexicon: roots, words, each word's dialect forms,
sentences, sources and the full change history, plus live label fixes (`translations/dv`). The
corpus project takes all of it over; TaxiQ then reads its labels from here like any app.

The shapes are the same on both sides: `src/core/corpus.ts` and the lexicon section of
`firestore.rules` are TaxiQ's, copied (`scripts/build-rules.py` records how); only the editor check
changed (`editors/{email}` here, TaxiQ's `roles/{email}.corpus` there).

## Steps

1. **Freeze editing in TaxiQ**: tell the corpus editors to stop for the move (minutes).
2. **Two service-account keys** (secrets), each from Firebase console → Project settings →
   Service accounts → Generate new private key: one for `kd-taxiq`, one for the corpus project. Save
   them under `secrets/` in this repo (git ignores it) or anywhere outside a repo.
3. **Dry run**: reads both, copies nothing:
   ```sh
   node scripts/migrate-taxiq.mjs --from secrets/taxiq.json --to secrets/corpus.json
   ```
4. **Copy**:
   ```sh
   node scripts/migrate-taxiq.mjs --from secrets/taxiq.json --to secrets/corpus.json --write
   ```
   It prints the counts of both sides; every row must say `same: true`.
5. **Delete both key files**, and in each console revoke the keys (Service accounts → Manage keys).
6. **TaxiQ** (next slice, docs/ROADMAP.md): its corpus screens and the corpus collections are removed
   from TaxiQ, its label editor writes here, and it reads `published/taxiq`. Until that release,
   leave TaxiQ's copy alone; do not edit words in both places.

`seed/taxiq-fixes.json` (written by step 4) holds TaxiQ's label fixes keyed by its i18n keys. They
become corrections of app `taxiq` once TaxiQ's strings are imported (TaxiQ's export script, ROADMAP).

Nothing in TaxiQ is changed or deleted by the script.
