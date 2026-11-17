"""Export every Dhivehi string of the fc-eforms plugin in the corpus import format.

    python scripts/export-fc-eforms.py <path to wp-content/plugins/fc-eforms> > seed/fc-eforms.json

The plugin writes its Dhivehi inline (PHP and JS literals, and the 17 form specs), so it is a
"text" app: each string's key is textKey(text) (src/core/strings.ts: "t:" + 16 hex of SHA-256 of
the normalised text), which the plugin computes the same way when it looks a correction up.
Moves into the plugin as tools/export-dv.py when the plugin reads corrections (docs/ROADMAP.md).
"""
import collections, glob, hashlib, json, os, re, sys, unicodedata

P = sys.argv[1]
sys.stdout.reconfigure(encoding="utf-8")
TH = re.compile("[ހ-޿]")
LIT = re.compile(r"'((?:[^'\\]|\\.)*)'" + "|" + r'"((?:[^"\\]|\\.)*)"')
GROUPS = {
    "class-fc-eforms-render.php": "ui: pages",
    "class-fc-eforms-flow.php": "ui: messages",
    "class-fc-eforms-rules.php": "ui: field errors",
    "class-fc-eforms-sms.php": "sms",
    "class-fc-eforms-spec.php": "ui: wizard and forms list",
    "class-fc-eforms-filing.php": "ui: status",
    "class-fc-eforms-seed.php": "ui: test mode",
    "eforms-flow.js": "ui: in-page checks",
}


def norm(s):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s)).strip()


def key(s):
    return "t:" + hashlib.sha256(norm(s).encode("utf-8")).hexdigest()[:16]


def unescape(s, quote):
    return s.replace("\\" + quote, quote).replace("\\\\", "\\")


out = collections.OrderedDict()


def add(text, where, group, context):
    if not TH.search(text):
        return
    k = key(text)
    e = out.setdefault(k, {"key": k, "dv": norm(text), "where": [], "group": group, "context": context})
    if len(e["where"]) < 40 and where not in e["where"]:
        e["where"].append(where)


files = sorted(glob.glob(os.path.join(P, "includes", "*.php"))) + [os.path.join(P, "assets", "eforms-flow.js")]
for f in files:
    base = os.path.basename(f)
    for ln, line in enumerate(open(f, encoding="utf-8").read().split("\n"), 1):
        for m in LIT.finditer(line):
            single = m.group(1) is not None
            s = unescape(m.group(1) if single else m.group(2), "'" if single else '"')
            ctx = "contains HTML: keep the tags as they are" if "<" in s else ""
            add(s, f"{base}:{ln}", GROUPS.get(base, "ui"), ctx)

# Form wording: label_dv, title_dv … in each spec. A text used by several forms is one string.
CONTEXT = {"label_dv": "question", "title_dv": "title", "heading_dv": "section heading", "question_dv": "question",
           "notice_dv": "notice", "footnote_dv": "footnote", "text": "instructions"}


def walk(node, path, form):
    if isinstance(node, dict):
        for k, v in node.items():
            walk(v, path + [k], form)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, path + [str(i)], form)
    elif isinstance(node, str):
        field = next((p for p in reversed(path) if not p.isdigit()), "")
        add(node, f"{form}:{'.'.join(path[-3:])}", "form: " + form, CONTEXT.get(field, field.replace("_dv", "")))


for f in sorted(glob.glob(os.path.join(P, "app", "specs", "*.json"))):
    form = os.path.basename(f)[:-5]
    walk(json.load(open(f, encoding="utf-8")), [], form)

# A form string used by more than one form: grouped as shared, every place listed.
for e in out.values():
    forms = {w.split(":")[0] for w in e["where"] if w.startswith("Fm-")}
    if len(forms) > 1:
        e["group"] = "form: shared by several forms"

doc = {
    "format": "dhivehi-corpus/strings-1",
    "app": "fc-eforms",
    "name": "Family Court eForms (website)",
    "keyStyle": "text",
    "strings": list(out.values()),
}
json.dump(doc, sys.stdout, ensure_ascii=False, indent=1)
print(file=sys.stderr)
print(len(out), "strings:", dict(collections.Counter(e["group"].split(":")[0] for e in out.values())), file=sys.stderr)
