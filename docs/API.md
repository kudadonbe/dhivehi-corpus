# API: how an app connects to the corpus

An app gives the corpus its Dhivehi strings once (import), and from then on reads the corrections
for its strings from one public, read-only document: `published/{app}`. A correction saved in the
corpus is in that document the same moment.

| App | Reads corrections by | Delay |
|---|---|---|
| Web apps (TaxiQ, Aailaa, Madhoshi pages) | A live Firestore listener on `published/{app}` | Real time (about a second) |
| Server apps (fc-eforms on WordPress, fc-api, Madhoshi) | HTTPS GET of the same document, cached | The cache time (60 s recommended) |

No key is needed to read: corrections are public wording, not personal data. Only signed-in
corpus editors can write (`firestore.rules`).

## 1. The published document

`published/{app}` (e.g. `published/fc-eforms`):

```json
{ "entries": { "<key>": "<corrected Dhivehi>", … }, "count": 12, "updatedBy": "editor@…", "updatedAt": <timestamp> }
```

`entries` holds **only corrected strings**. Anything not in it: the app shows its own built-in text.

## 2. Keys

| App style | Key | Example |
|---|---|---|
| `keys`: the app has symbolic keys | Its own key, dotted | `errors.taken` (TaxiQ) |
| `text`: Dhivehi written inline in the code | `t:` + the first 16 hex digits of SHA-256 of the **normalised** text | `t:3fa1…` (fc-eforms) |

Normalised: Unicode NFC, every run of whitespace as one space, trimmed. The same in every language:

```php
// PHP (fc-eforms)
function fc_dv_key( string $text ): string {
	$norm = trim( preg_replace( '/\s+/u', ' ', Normalizer::normalize( $text, Normalizer::FORM_C ) ) );
	return 't:' . substr( hash( 'sha256', $norm ), 0, 16 );
}
```
PHP's `Normalizer` needs the `intl` extension. Where a host lacks it, skip the NFC step: Dhivehi
typed in code and specs is already NFC, so the key comes out the same.

```go
// Go (fc-api, Madhoshi)
func Key(text string) string {
	norm := strings.Join(strings.Fields(norm.NFC.String(text)), " ") // golang.org/x/text/unicode/norm
	sum := sha256.Sum256([]byte(norm))
	return "t:" + hex.EncodeToString(sum[:])[:16]
}
```
```ts
// TypeScript: textKey() in src/core/strings.ts
```

## 3. Web apps: real time

```ts
import { doc, onSnapshot, getFirestore } from 'firebase/firestore'
import { initializeApp } from 'firebase/app'

const corpus = initializeApp({ projectId: 'kd-dhivehi-corpus', apiKey: '<corpus web API key>' }, 'corpus')
onSnapshot(doc(getFirestore(corpus), 'published', 'taxiq'), (d) => {
  const fixes: Record<string, string> = d.data()?.entries ?? {}
  // show fixes[key] ?? builtIn  (TaxiQ already does this with applyOverrides)
})
```

A second Firebase app (`'corpus'`) beside the app's own: the app keeps its own project for its own
data. If the corpus cannot be reached, the app shows its built-in text: never block on it.

## 4. Server apps: HTTPS with a cache

```
GET https://firestore.googleapis.com/v1/projects/kd-dhivehi-corpus/databases/(default)/documents/published/fc-eforms
```

The answer is Firestore's REST shape; the corrections are at `fields.entries.mapValue.fields`, each
`{ "<key>": { "stringValue": "<text>" } }`. A 404 means the app has no corrections yet.

```php
// fc-eforms (sketch; built in the plugin as FC_EForms_Text, docs/ROADMAP.md)
$fixes = get_transient( 'fc_eforms_dv_fixes' );
if ( $fixes === false ) {
	$r     = wp_remote_get( $url, array( 'timeout' => 3 ) );
	$json  = json_decode( wp_remote_retrieve_body( $r ), true );
	$fixes = array();
	foreach ( $json['fields']['entries']['mapValue']['fields'] ?? array() as $k => $v ) {
		$fixes[ $k ] = (string) ( $v['stringValue'] ?? '' );
	}
	set_transient( 'fc_eforms_dv_fixes', $fixes, 60 );   // also on failure: no retry storm
}
echo esc_html( $fixes[ fc_dv_key( $built_in ) ] ?? $built_in );
```

Rules for every server client: a short timeout (3 s), cache both success and failure, keep the last
good copy if a fetch fails, and never let the page wait on the corpus.

## 5. Import format (an app's strings into the corpus)

Each app has an export script that writes this; an editor imports it on the **Apps** page.

```json
{
  "format": "dhivehi-corpus/strings-1",
  "app": "fc-eforms",
  "name": "Family Court eForms (website)",
  "keyStyle": "text",
  "strings": [
    { "key": "t:3fa1…", "dv": "ކުރިއަށް", "en": "Next", "context": "button", "where": ["class-fc-eforms-render.php:214"], "group": "ui: pages" }
  ]
}
```

| Field | |
|---|---|
| `key` | Required, unique in the file, ≤ 200 characters |
| `dv` | Required, the built-in Dhivehi, ≤ 4,000 characters |
| `en`, `context`, `where`, `group` | Optional; help the editor (what it is, where it shows) |

Importing again is safe: new strings are added, changed ones updated, corrections kept. A corrected
string whose fix now matches the app's built-in text is recorded as landed (the fix went into the
code). A string the app dropped is set aside (`retired`), never deleted.

## 6. Writing fixes back into the code

**Apps → Download corrections** gives `{ "format": "dhivehi-corpus/fixes-1", "fixes": [ { key, where, en, before, after } ] }`.
A developer writes each `after` into the code at `where`; the next import sees them as landed and the
app stops needing them from `published/`.

Examples in this repo: `scripts/export-fc-eforms.py` (a text-keyed app) and `seed/fc-eforms.json`
(its first export, 1,110 strings).
