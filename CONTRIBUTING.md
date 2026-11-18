# Contributing to the Dhivehi corpus

Everyone is welcome: speakers of any dialect, teachers, students, writers, developers.

## Ways to help

| You can | How |
|---|---|
| **Add or correct words** | On the corpus site, sign in with Google and suggest a word, a meaning, a dialect form (Malé, Addu, Huvadhu, Fuvahmulah, Naifaru) or an example sentence. An editor reviews it before it is published. |
| **Check app wording** | Review the Dhivehi of the connected apps under "App labels" and suggest corrections. |
| **Cite your sources** | Every entry names where it comes from: a book (title, author, year, page), a person (a short label like "elder, Hithadhoo": never a name or phone number), fieldwork, a website. Do not copy a dictionary or a copyrighted text: write in your own words and cite it. |
| **Improve the code** | Open an issue or a pull request on GitHub. Read `CLAUDE.md` and `docs/` first. |

## Rules

1. **Your contribution is published under CC BY-SA 4.0** (data) or MIT (code): see
   `DATA-LICENSE.md` and `LICENSE`. Only contribute what you may share.
2. **No personal data** about anyone: no names of speakers, no phone numbers, no addresses.
3. **Be accurate**: when unsure, say so in the notes; an editor can mark an entry verified.
4. **Every change is kept** in the history: who and when. Editors may revert.

## For developers

```sh
pnpm install
pnpm test      # unit tests
pnpm build     # type check + build
pnpm lint
```

The site needs a Firebase web config in `.env.local` (`docs/SETUP.md`). Pull requests: one topic,
tests for logic, `pnpm test`, `pnpm build` and `pnpm lint` passing. The contract other apps use
(`docs/API.md`) changes only with a new format version.
