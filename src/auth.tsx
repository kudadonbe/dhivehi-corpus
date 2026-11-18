import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'

// Who is signed in, and whether they are a corpus editor (editors/{email}) or an admin.
interface AuthState {
  ready: boolean
  user: User | null
  email: string
  editor: boolean
  admin: boolean
  error: string
  signIn: () => void
  signOut: () => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<{ email: string; editor: boolean; admin: boolean }>({ email: '', editor: false, admin: false })
  const [error, setError] = useState('')

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true) }), [])

  const email = (user?.email ?? '').toLowerCase()
  useEffect(() => {
    if (!email || !user?.emailVerified) return
    return onSnapshot(
      doc(db, 'editors', email),
      (d) => setRole({ email, editor: d.exists(), admin: d.exists() && d.data().admin === true }),
      // Not an editor: the rules refuse the read.
      () => setRole({ email, editor: false, admin: false }),
    )
  }, [email, user?.emailVerified])

  const mine = role.email === email
  const value: AuthState = {
    ready,
    user,
    email,
    editor: mine && role.editor,
    admin: mine && role.admin,
    error,
    signIn: () => {
      setError('')
      signInWithPopup(auth, googleProvider).catch((e: { code?: string }) => {
        if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') setError(e.code ?? 'failed') // the message itself: auth.error (src/ui/text.ts)
      })
    },
    signOut: () => void signOut(auth),
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}
