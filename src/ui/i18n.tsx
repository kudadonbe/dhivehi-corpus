import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { configured, db } from '../firebase'
import { UI, type UiKey } from './text'

// The site's wording (src/ui/text.ts), with the corrections editors save for app "dhivehi-corpus"
// laid over it in real time, exactly as any connected app reads published/{app} (docs/API.md).
// If the corpus cannot be read, the built-in Dhivehi shows.

export const UI_APP = 'dhivehi-corpus'

type Vars = Record<string, string | number>
type Nodes = Record<string, ReactNode>

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s)

export interface T {
  (key: UiKey, vars?: Vars): string
  // The same with elements in the gaps: tr('gate.notSetUp.body', { file: <code>.env.local</code> }).
  rich: (key: UiKey, nodes: Nodes) => ReactNode
}

function makeT(fixes: Record<string, string>): T {
  const raw = (key: UiKey) => fixes[key] || UI[key][0]
  const t = ((key: UiKey, vars?: Vars) => fill(raw(key), vars)) as T
  t.rich = (key, nodes) => raw(key).split(/(\{\w+\})/).map((part, i) => {
    const k = /^\{(\w+)\}$/.exec(part)?.[1]
    return <Fragment key={i}>{k && k in nodes ? nodes[k] : part}</Fragment>
  })
  return t
}

const Ctx = createContext<T>(makeT({}))

export function UiTextProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<T>(() => makeT({}))
  useEffect(() => {
    if (!configured) return
    return onSnapshot(
      doc(db, 'published', UI_APP),
      (d) => setT(() => makeT((d.data()?.entries ?? {}) as Record<string, string>)),
      () => undefined, // unreadable: keep the built-in text
    )
  }, [])
  return <Ctx.Provider value={t}>{children}</Ctx.Provider>
}

export const useT = () => useContext(Ctx)
