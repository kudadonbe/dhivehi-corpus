// Firebase app, Auth and Firestore of the corpus project. The web config comes from .env.local
// (VITE_FB_*, see .env.example); it identifies the project and is not a secret.
import { initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

export const configured = Boolean(import.meta.env.VITE_FB_PROJECT_ID && import.meta.env.VITE_FB_API_KEY)

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FB_API_KEY ?? 'missing',
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID ?? 'missing',
  appId: import.meta.env.VITE_FB_APP_ID,
})
export const auth = getAuth(app)
export const db = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
