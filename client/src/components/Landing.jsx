import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function createRoom() {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      const { code: newCode } = await res.json();
      navigate(`/room/${newCode}`);
    } catch {
      alert('Failed to create room. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  function joinRoom(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length === 4) navigate(`/room/${trimmed}`);
  }

  return (
    <div className="landing">
      <ThemeToggle className="landing-theme-toggle" />
      <div className="landing-content">
        <h1 className="logo">share<span>2d</span></h1>
        <p className="tagline">Paste, share, done. No login. No install.</p>

        <button className="btn-primary" onClick={createRoom} disabled={loading}>
          {loading ? 'Creating...' : 'Create Room'}
        </button>

        <div className="divider"><span>or join</span></div>

        <form className="join-form" onSubmit={joinRoom}>
          <input
            type="text"
            placeholder="ABCD"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="code-input"
          />
          <button type="submit" className="btn-secondary" disabled={code.length !== 4}>
            Join
          </button>
        </form>

        <p className="hint">Type, paste, or drop files - shared instantly across every device in the room.</p>
      </div>
    </div>
  );
}
