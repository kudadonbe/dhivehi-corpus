"""Assemble firestore.rules: head + TaxiQ's corpus section (verbatim, editor check swapped) + tail.

Run once from the repo root with the TaxiQ checkout beside it:
    python scripts/build-rules.py ../TaxiQ/firestore.rules
After this the corpus owns its rules; edit firestore.rules directly. Kept for the record of where the
lexicon rules came from (TaxiQ v2.17.0).
"""
import pathlib, sys

here = pathlib.Path(__file__).parent
src = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").split("\n")
start = next(i for i, l in enumerate(src) if "---- Dhivehi corpus" in l)
hist = next(i for i in range(start, len(src)) if "match /corpusHistory/" in src[i])
end = next(i for i in range(hist, len(src)) if src[i] == "    }")
section = "\n".join(src[start:end + 1])

old_editor = """    function corpusEditor() {
      // The corpus flag first: a corpus-only entry may have no role field.
      return signedIn() && exists(roleDoc())
        && (get(roleDoc()).data.get('corpus', false) == true || isPlatform());
    }"""
assert old_editor in section, "TaxiQ's corpusEditor() changed; update this script"
section = section.replace(old_editor, """    function corpusEditor() {
      // In the corpus project: anyone in editors/{email} (TaxiQ used its roles' corpus flag).
      return isEditor();
    }""")
old_cols = "request.resource.data.collection in ['corpusRoots', 'corpusWords', 'corpusForms', 'corpusSentences', 'corpusSources']"
assert old_cols in section
section = section.replace(old_cols, "request.resource.data.collection in ['corpusRoots', 'corpusWords', 'corpusForms', 'corpusSentences', 'corpusSources', 'corpusApps', 'corpusStrings']")
section = section.replace(
    "    // ---- Dhivehi corpus (src/core/corpus.ts, src/corpus.ts): the owner's own research, never",
    "    // ---- The lexicon (moved from TaxiQ v2.17.0 firestore.rules): the owner's own research, never", 1)

out = (here / "rules-head.txt").read_text(encoding="utf-8") + section + "\n" + (here / "rules-tail.txt").read_text(encoding="utf-8")
(here.parent / "firestore.rules").write_text(out, encoding="utf-8", newline="\n")
print("firestore.rules:", out.count("\n"), "lines")
