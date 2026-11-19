# Lessons from the Quranic Arabic Corpus

Read 2026-11-18 by Claude for the project lead: https://corpus.quran.com/ (Leeds, Kais Dukes; site
2009–2017, data v0.4 of 2011). What its design offers this corpus, and the decisions it needs. Not
yet in docs/ROADMAP.md: add the chosen items there once decided.

## Its data: not for import

- Quranic Arabic only; nothing Dhivehi.
- Terms in the data header: GPL, but "CHANGING IT IS NOT ALLOWED" (verbatim copies only), name the
  source and link corpus.quran.com. The download asks for an email; not downloaded.
- Linking to it is fine (see idea 7).

## How it is built

| Part | What it does |
|---|---|
| Word segments | Each word split into prefix, stem(s), suffixes; each segment has its own part-of-speech tag and features (e.g. *fa* CONJ + *jaʿal* V + *nā* PRON + *hum* PRON) |
| Tagset | About 40 POS tags (nouns, verbs, ~25 particle kinds) and features: person, gender, number, aspect, mood, voice, verb form, state, case, derivation; root and lemma in a fixed Latin scheme (extended Buckwalter) |
| Location ids | Every word addressed `chapter:verse:word` (e.g. `1:1:1`), deep-linkable |
| Dictionary | Root → lemma → every occurrence with its verse and gloss, and counts ("occurs 25 times"); verb concordance, lemma frequency, morphological search |
| Treebank | A dependency graph per verse over the same word ids |
| Ontology | 300 concepts, 350 relations; named entities and pronouns linked to concepts |
| Corrections | Click a word → public message thread; moderators settle; 5,234 threads archived |
| Translation | Word-by-word English per segment, seven parallel verse translations |

## Ideas for the Dhivehi corpus

| # | Idea | Why | Our model today |
|---|---|---|---|
| 1 | **Words split into parts** (stem + endings: ގެ، އަށް، އަކީ، ތައް …) | Dhivehi adds endings; search should find a word under any ending | Whole words + dialect forms (`src/core/corpus.ts`) |
| 2 | **A Dhivehi tagset** of word classes and features, including the **three levels of respect** (ordinary, polite, royal/religious) | One agreed way to describe every word | `pos` has 7 values |
| 3 | **Word addresses** `source:sentence:word` and a **concordance**: every use of a word | Real examples for every word | Sentences link to words (`wordIds`), no positions |
| 4 | **Counts** per word and root | Shows what is common; guides review order | None (the word bank crawler counts web text: docs/WORDBANK.md) |
| 5 | **Court glossary**: one agreed Dhivehi term per legal concept (applicant, respondent, protection order …) used by eForms, Madhoshi, Aailaa | The same thing is now worded differently in different apps | Roadmap slice 8 mentions a glossary |
| 6 | **One fixed Latin spelling** for `latin` fields | Free-text Latin spells one word two ways; search misses it | `latin` is free text |
| 7 | **Link to the Arabic root** for words of Arabic origin (a field like `arabicRoot: "ktb"` → corpus.quran.com's root page) | Many Dhivehi words come from Arabic; a link, not copied data | `origin: 'arabic'` only |

Already on the roadmap and matching their correction model: slice 9, public project, where anyone
signed in suggests and editors review.

## A possible source: the Dhivehi Quran translation

`kudadonbe/Quran-Translation` is the digital copy of the **official** Dhivehi translation (used
by tanzil.net, zekr and quran.mv), verse by verse beside the Arabic. It has **no licence**, and
the translation's copyright is not ours. It could supply real Dhivehi sentences with
`chapter:verse` addresses, but only with the copyright holder's permission. Without permission,
words may link to a verse but its text is not stored. The corpus data is CC BY-SA 4.0, which the
translation's terms would have to allow.

## Decisions needed (the project lead)

1. Which of ideas 1–7 go on the roadmap, and in what order relative to slice 5 (eForms reading
   corrections).
2. The Latin scheme for idea 6. Suggested: the official Malé Latin (1976 Latinisation).
3. The grammar reference for ideas 1–2 (a book, or a person who confirms endings and tags), and
   who decides a word's respect level.
4. The translation: who holds the official translation's copyright (Ministry of Islamic Affairs?
   President's Office?), and whether permission can be had.
5. Who settles court terms for idea 5 (Registrar, Chief Judge, a staff committee); about 20 to
   start, drawn from the eForms wording.
