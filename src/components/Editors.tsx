import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

interface Editor { email: string; name: string; admin: boolean }

// Admins only: who may review and correct (editors/{email}).
export function Editors({ me }: { me: string }) {
  const [list, setList] = useState<Editor[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [admin, setAdmin] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => onSnapshot(collection(db, 'editors'), (s) => setList(s.docs.map((d) => ({ email: d.id, name: String(d.data().name ?? ''), admin: d.data().admin === true })).sort((a, b) => a.email.localeCompare(b.email))), () => setList([])), [])
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const save = async (e: Editor) => {
    setErr('')
    try { await setDoc(doc(db, 'editors', e.email.trim().toLowerCase()), { name: e.name.trim(), admin: e.admin, addedBy: me, addedAt: serverTimestamp() }) } catch { setErr('Not saved.') }
  }
  return (
    <section className="editors">
      <h2>Editors</h2>
      <p className="hint">They sign in with this Google address. Editors review and correct; admins also manage this list.</p>
      <form className="card form" onSubmit={async (ev) => { ev.preventDefault(); await save({ email, name, admin }); setEmail(''); setName(''); setAdmin(false) }}>
        <div className="grid2">
          <label className="field"><span>Email</span><input id="ed-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>Name</span><input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
        <label className="switch"><input id="ed-admin" type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> Admin</label>
        <div className="actions"><button type="submit" className="primary" disabled={!valid}>Add editor</button></div>
        {err && <p className="problem" role="alert">{err}</p>}
      </form>
      <ul className="editor-list">
        {list.map((e) => (
          <li key={e.email} className="card">
            <span><strong>{e.name || e.email}</strong> <span className="hint">{e.email}</span></span>
            <span className="actions">
              {e.admin && <span className="pill">admin</span>}
              {e.email !== me && <button type="button" onClick={() => save({ ...e, admin: !e.admin })}>{e.admin ? 'Make editor' : 'Make admin'}</button>}
              {e.email !== me && <button type="button" className="quiet" onClick={() => deleteDoc(doc(db, 'editors', e.email)).catch(() => setErr('Not removed.'))}>Remove</button>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
