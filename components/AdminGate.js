'use client';
import { useEffect, useState } from 'react';
import ClothBg from './ClothBg';

export default function AdminGate({ children, title = 'Admin' }) {
  const [ok, setOk] = useState(null);
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then(async (r) => {
        if (r.ok) return setOk(true);
        const j = await r.json().catch(() => ({}));
        if (r.status === 500) setErr(j.error || 'Server not configured.');
        setOk(false);
      })
      .catch(() => setOk(false));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setOk(true);
    else setErr(j.error || 'Hindi naka-login.');
  }

  if (ok === null) return <div className="center-screen"><div className="loader" /></div>;
  if (ok) return children;

  return (
    <div className="center-screen gate">
      <ClothBg />
      <form className="gate-card stage3d" onSubmit={submit}>
        <div className="gate-card-inner">
        <p className="gate-show">A Day INA: LIVE</p>
        <h1>{title}</h1>
        <label className="field">
          <span>PIN</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
        </label>
        {err && <p className="err">{err}</p>}
        <button className="btn3d btn-block" disabled={busy || !pin}>{busy ? 'Checking…' : 'Enter'}</button>
        </div>
      </form>
    </div>
  );
}

export async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.reload();
}
