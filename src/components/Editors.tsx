import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useT } from '../ui/i18n'

interface Editor { email: string; name: string; admin: boolean }

// Admins only: who may review and correct (editors/{email}).
export function Editors({ me }: { me: string }) {
  const t = useT()
  const [list, setList] = useState<Editor[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [admin, setAdmin] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => onSnapshot(collection(db, 'editors'), (s) => setList(s.docs.map((d) => ({ email: d.id, name: String(d.data().name ?? ''), admin: d.data().admin === true })).sort((a, b) => a.email.localeCompare(b.email))), () => setList([])), [])
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const save = async (e: Editor) => {
    setErr('')
    try { await setDoc(doc(db, 'editors', e.email.trim().toLowerCase()), { name: e.name.trim(), admin: e.admin, addedBy: me, addedAt: serverTimestamp() }) } catch { setErr(t('common.notSaved')) }
  }
  return (
    <section className="editors">
      <h2>{t('nav.editors')}</h2>
      <p className="hint">{t('editors.hint')}</p>
      <form className="card form" onSubmit={async (ev) => { ev.preventDefault(); await save({ email, name, admin }); setEmail(''); setName(''); setAdmin(false) }}>
        <div className="grid2">
          <label className="field"><span>{t('editors.email')}</span><input id="ed-email" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>{t('common.name')}</span><input id="ed-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} /></label>
        </div>
        <label className="switch"><input id="ed-admin" type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> {t('editors.admin')}</label>
        <div className="actions"><button type="submit" className="primary" disabled={!valid}>{t('editors.add')}</button></div>
        {err && <p className="problem" role="alert">{err}</p>}
      </form>
      <ul className="editor-list">
        {list.map((e) => (
          <li key={e.email} className="card">
            <span><strong><bdi dir="auto">{e.name || e.email}</bdi></strong> <bdi className="hint" dir="ltr">{e.email}</bdi></span>
            <span className="actions">
              {e.admin && <span className="pill">{t('editors.admin')}</span>}
              {e.email !== me && <button type="button" onClick={() => save({ ...e, admin: !e.admin })}>{t(e.admin ? 'editors.makeEditor' : 'editors.makeAdmin')}</button>}
              {e.email !== me && <button type="button" className="quiet" onClick={() => deleteDoc(doc(db, 'editors', e.email)).catch(() => setErr(t('common.notRemoved')))}>{t('common.remove')}</button>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
