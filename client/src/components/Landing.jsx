import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(location.state?.error || '');

  async function createRoom() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create room');
      const { code: newCode } = await res.json();
      navigate(`/room/${newCode}`);
    } catch {
      setError('Failed to create room. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  async function joinRoom(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 4) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/rooms/${trimmed}`);
      if (res.status === 404) {
        setError('Room not found. Check the code or create a new room.');
        return;
      }
      if (!res.ok) {
        setError('Could not join room. Please try again.');
        return;
      }
      navigate(`/room/${trimmed}`);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing">
      <ThemeToggle className="landing-theme-toggle" />
      <div className="landing-content">
        <h1 className="logo">share<span>2d</span></h1>
        <p className="tagline">Paste, share, done. No login. No install.</p>

        {error && <p className="join-error" role="alert">{error}</p>}

        <button className="btn-primary" onClick={createRoom} disabled={loading}>
          {loading ? 'Please wait...' : 'Create Room'}
        </button>

        <div className="divider"><span>or join</span></div>

        <form className="join-form" onSubmit={joinRoom}>
          <input
            type="text"
            placeholder="ABCD"
            maxLength={4}
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
            className="code-input"
            disabled={loading}
          />
          <button type="submit" className="btn-secondary" disabled={code.length !== 4 || loading}>
            {loading ? 'Checking...' : 'Join'}
          </button>
        </form>

        <p className="hint">Type, paste, or drop files - shared instantly across every device in the room.</p>
      </div>
    </div>
  );
}
