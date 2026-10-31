import React, { useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function ForcePasswordChange({ session, onComplete }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError('');
    if (password.length < 8) { setError('Password कम से कम 8 characters का होना चाहिए।'); return; }
    if (password !== confirm) { setError('दोनों password एक जैसे नहीं हैं।'); return; }
    setBusy(true);
    try {
      await updatePassword(auth.currentUser, password);
      await updateDoc(doc(db, 'users', session.uid), { mustChangePassword: false });
      onComplete();
    } catch (e) { setError(e.code === 'auth/requires-recent-login' ? 'कृपया logout करके नए temporary password से फिर login करें, फिर password बदलें।' : e.message); }
    finally { setBusy(false); }
  }
  return <main className="login-page"><section className="login-right" style={{gridColumn:'1 / -1'}}><form className="login-box" onSubmit={submit}><span className="eyebrow">ACCOUNT SECURITY</span><h2>अपना नया password बनाएं</h2><p>Owner ने जो temporary password दिया है, उसके बाद अपना निजी password सेट करें।</p><label className="login-input-label">New password<input type="password" minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><label className="login-input-label">Confirm new password<input type="password" minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required /></label>{error&&<div className="login-error">{error}</div>}<button className="btn primary login-btn" disabled={busy}>{busy?'Saving…':'Save new password'}</button></form></section></main>;
}
