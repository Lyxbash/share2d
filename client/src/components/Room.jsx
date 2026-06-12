import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import ShareItem from './ShareItem';
import Composer from './Composer';
import './Room.css';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ROOM_CODE_REGEX = /^[A-Z0-9]{4}$/;

export default function Room() {
  const { code: rawCode } = useParams();
  const code = rawCode?.toUpperCase();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [presence, setPresence] = useState(1);
  const [connected, setConnected] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [deletingIds, setDeletingIds] = useState(new Set());
  const socketRef = useRef(null);
  const socketIdRef = useRef(null);
  const dragCounter = useRef(0);
  const prevPresence = useRef(1);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    document.body.classList.add('editor-mode');
    return () => document.body.classList.remove('editor-mode');
  }, []);

  useEffect(() => {
    if (!code || !ROOM_CODE_REGEX.test(code)) {
      navigate('/', { replace: true });
    }
  }, [code, navigate]);

  useEffect(() => {
    if (!code || !ROOM_CODE_REGEX.test(code)) return;

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    const joinRoom = () => socket.emit('join', code);

    socket.on('connect', () => {
      socketIdRef.current = socket.id;
      setConnected(true);
      joinRoom();
    });

    socket.on('disconnect', () => setConnected(false));
    socket.io.on('reconnect', joinRoom);

    socket.on('history', (history) => setItems(history));
    socket.on('item', (item) => {
      setItems((prev) => {
        if (prev.some((i) => i.id === item.id)) return prev;
        return [item, ...prev];
      });
      if (item.senderId && item.senderId !== socketIdRef.current) {
        showToast('New item received');
      }
    });
    socket.on('item-deleted', ({ id }) => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setDeletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    });
    socket.on('cleared', () => setItems([]));
    socket.on('presence', (count) => {
      setPresence(count);
      if (count > prevPresence.current) {
        showToast(`${count} device${count !== 1 ? 's' : ''} connected`);
      }
      prevPresence.current = count;
    });
    socket.on('error', ({ message }) => showToast(message));

    return () => socket.disconnect();
  }, [code, showToast]);

  useEffect(() => {
    const url = `${window.location.origin}/room/${code}`;
    QRCode.toDataURL(url, { width: 200, margin: 2, color: { dark: '#6c5ce7', light: '#ffffff00' } })
      .then(setQrDataUrl);
  }, [code]);

  const uploadFile = useCallback(async (file) => {
    if (file.size > MAX_FILE_SIZE) {
      showToast(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/rooms/${code}/files`);
      if (socketIdRef.current) xhr.setRequestHeader('X-Socket-Id', socketIdRef.current);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        setUploadProgress(null);
        if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
        else {
          let msg = 'Upload failed';
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* ignore */ }
          showToast(msg);
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => { setUploadProgress(null); showToast('Upload failed'); reject(new Error('Upload failed')); };
      xhr.send(formData);
    });
  }, [code, showToast]);

  const uploadBlob = useCallback(async (blob) => {
    const file = new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type || 'image/png' });
    await uploadFile(file);
  }, [uploadFile]);

  const handleGlobalPaste = useCallback(async (e) => {
    if (e.target.closest('.composer-input, textarea, input')) return;

    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    for (const item of clipboardItems) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) await uploadBlob(blob);
        return;
      }
    }

    const text = e.clipboardData.getData('text/plain');
    if (text.trim()) {
      e.preventDefault();
      socketRef.current?.emit('text', { text });
    }
  }, [uploadBlob]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    for (const file of e.dataTransfer.files) await uploadFile(file);
  }, [uploadFile]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  };

  const handleSend = (text) => socketRef.current?.emit('text', { text });

  const handleDelete = (id) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    socketRef.current?.emit('delete', { id });
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    if (window.confirm('Clear everything in this room?')) {
      socketRef.current?.emit('clear-all');
      showToast('Room cleared');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    showToast('Code copied');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
    showToast('Link copied');
  };

  return (
    <div
      className="room"
      onPaste={handleGlobalPaste}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-content">Drop files here</div>
        </div>
      )}

      <header className="room-header">
        <button className="back-btn" onClick={() => navigate('/')} title="Back">←</button>
        <div className="room-code-area">
          <span className="room-code" onClick={copyCode} title="Click to copy code">{code}</span>
          <div className="room-actions">
            <button className="icon-btn" onClick={copyLink} title="Copy link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            <button className={`icon-btn ${showQr ? 'active' : ''}`} onClick={() => setShowQr(!showQr)} title="QR code">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><line x1="21" y1="14" x2="21" y2="21"/><line x1="14" y1="21" x2="21" y2="21"/></svg>
            </button>
            {items.length > 0 && (
              <button className="icon-btn danger" onClick={handleClearAll} title="Clear all">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            )}
          </div>
        </div>
        <div className="presence">
          <span className={`presence-dot ${connected ? (presence > 1 ? 'active' : 'online') : 'offline'}`} />
          {connected ? presence : '…'}
        </div>
      </header>

      {showQr && qrDataUrl && (
        <div className="qr-panel">
          <img src={qrDataUrl} alt="QR code to join room" />
          <p>Scan to join on another device</p>
        </div>
      )}

      {uploadProgress !== null && (
        <div className="upload-bar">
          <div className="upload-bar-fill" style={{ width: `${uploadProgress}%` }} />
          <span>{uploadProgress}%</span>
        </div>
      )}

      <div className="items-feed">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✦</div>
            <p>Your shared space is empty</p>
            <p className="empty-hint">Type below, attach a file, paste with Ctrl+V, or drop anywhere</p>
          </div>
        ) : (
          items.map((item) => (
            <ShareItem
              key={item.id}
              item={item}
              deleting={deletingIds.has(item.id)}
              onImageClick={setLightbox}
              onDelete={handleDelete}
              showToast={showToast}
            />
          ))
        )}
      </div>

      <Composer
        onSend={handleSend}
        onPasteImage={uploadBlob}
        onPasteFiles={(files) => files.forEach(uploadFile)}
        onFilesSelected={uploadFile}
      />

      {toast && <div className="toast">{toast}</div>}

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Full size" />
          <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
