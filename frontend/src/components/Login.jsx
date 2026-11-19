import React, { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="font-display text-4xl font-bold text-accent mb-2">FILAWATCH</div>
          <div className="text-[10px] font-display text-gray-500 uppercase tracking-[0.3em]">
            // AUTHORIZED ACCESS ONLY
          </div>
        </div>

        <form onSubmit={submit} className="bg-blueprint/60 border border-line p-6 corner-marks relative">
          <div className="absolute -top-px left-0 right-0 h-px bg-accent" />
          <div className="scan-line absolute" />

          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">▸ USERNAME</div>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                required
                className="w-full bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-display">▸ PASSWORD</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-ink border border-line px-3 py-2 text-sm font-body focus:outline-none focus:border-accent"
              />
            </div>
            {error && (
              <div className="text-xs text-danger border border-danger/40 bg-danger/10 p-2">
                ⚠ {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-ink py-3 font-display text-xs uppercase tracking-widest hover:bg-yellow-400 disabled:opacity-50"
            >
              {loading ? '// AUTHENTICATING...' : '▸ LOGIN'}
            </button>
          </div>
        </form>

        <div className="text-[10px] text-gray-600 text-center mt-6 font-display uppercase tracking-widest">
          Default Login: admin / admin1234
        </div>
      </div>
    </div>
  );
}
