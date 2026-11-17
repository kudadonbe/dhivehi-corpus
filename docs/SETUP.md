# Setup: the corpus's own Firebase project

Once, by the owner. Nothing here goes into git except what the steps say.

## 1. The project

1. https://console.firebase.google.com → **Add project** → name **kd-dhivehi-corpus** (the id
   `.firebaserc` and `docs/API.md` use; if Firebase gives another id, change both).
   Google Analytics: off.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Build → Firestore Database → Create database**, production mode, location
   `asia-south1` (Mumbai, the nearest; it cannot be changed later).
4. **Project settings → General → Your apps → Web (</>)**, nickname `corpus-site`, tick
   **Firebase Hosting**. Copy `apiKey`, `authDomain`, `projectId`, `appId` into `.env.local` (from
   `.env.example`). These identify the project; they are not secrets, but `.env.local` stays out of git.

## 2. The first admin

Firestore → **Start collection** `editors` → document id = your Google address in lower case →
fields `admin` (boolean) `true`, `name` (string), `addedBy` (string) your address, `addedAt`
(timestamp) now. Every other editor is added on the site's **Editors** page.

## 3. Deploy

```sh
pnpm install
pnpm dlx firebase-tools login          # once, opens the browser
pnpm dlx firebase-tools deploy --only firestore:rules,firestore:indexes,hosting   # after pnpm build
```

The rules deploy is also their compile check (the emulator needs Java, not on the lead's PC).
The site is then at `https://kd-dhivehi-corpus.web.app`. Add that domain under **Authentication →
Settings → Authorized domains** if it is not listed.

## 4. First data

1. Sign in on the site → **Apps → Import an app's strings** → `seed/fc-eforms.json` (1,110 strings
   of the eForms website). About a minute.
2. Move TaxiQ's lexicon: `docs/MIGRATION.md`.

## 5. Lock the API key to the corpus's domains

Google Cloud console → APIs & Services → Credentials → the browser key → **Website restrictions**:
`kd-dhivehi-corpus.web.app`, `kd-dhivehi-corpus.firebaseapp.com`, `localhost` (development), plus
each web app that listens in real time (TaxiQ's and Aailaa's domains). Server apps read over the
REST URL without a key.
