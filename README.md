# share2d

A zero-barrier, browser-based live sharing room. Open the same short code on two devices and instantly exchange text, code, screenshots, and files.

## How it works

1. Click **Create Room** — you get a 4-character code (e.g. `K4XQ`)
2. Open the same code on another device (type it, scan the QR, or share the link)
3. **Ctrl+V** to paste text, code, or screenshots (Win+Shift+S snip → Ctrl+V)
4. Drag and drop files, or use the attach button
5. Everything appears instantly on every connected device

No login. No install. No upload dialogs.

## Architecture

```
Browser (React + Vite)  ←→  Socket.io (realtime)  ←→  Node.js + Express
                                    ↕
                          In-memory rooms + uploads/ folder
```

- **Text/code** travels over Socket.io (instant, no file upload)
- **Images/files** upload via REST (multer), then metadata broadcasts over Socket.io
- Rooms auto-expire after 24 hours of inactivity
- Max file size: 50 MB · Max text: 100 KB · Max items per room: 200

## Local development

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health

### Test on two devices (same Wi-Fi)

1. Run `npm run dev`
2. Find your PC's IP: `ipconfig` → look for IPv4 (e.g. `192.168.1.42`)
3. On your phone, open `http://192.168.1.42:5173`
4. Create a room on PC, join the same code on phone

## Production build

```bash
npm run build
npm start
```

Or one command:

```bash
npm run start:prod
```

The server serves the built frontend from `client/dist/` on a single port (default 3001, or `$PORT` in cloud).

## Deploy to Render (free) — recommended for cross-device

This is the easiest way for **two different devices anywhere** (phone on mobile data + laptop, etc.).

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → **Web Service**
3. Connect your repo
4. Render auto-detects `render.yaml`, or set manually:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Health check path:** `/health`
5. Deploy — you get a URL like `https://share2d-xxxx.onrender.com`
6. Open that URL on both devices, create/join the same room — done

### Other platforms

| Platform | Build | Start | Notes |
|---|---|---|---|
| Render | `npm install && npm run build` | `npm start` | Free tier, cold starts ~30s |
| Railway | same | same | Needs credit card for free tier |
| Fly.io | same | same | Good for always-on |
| VPS | same | `NODE_ENV=production npm start` | Use PM2 or systemd |

## Production checklist

| Check | Status |
|---|---|
| Single port serves API + frontend + websockets | Yes |
| Binds to `0.0.0.0` (cloud-ready) | Yes |
| Health endpoint `/health` | Yes |
| Socket.io reconnect + rejoin room | Yes |
| Path traversal protection on file downloads | Yes |
| File size / text length / item count limits | Yes |
| Internal server paths stripped from API responses | Yes |
| Graceful SIGTERM shutdown | Yes |
| Security headers (nosniff, noframe) | Yes |

## Environment variables

Copy `.env.example` to `.env` for local overrides:

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3001 | Server port |
| `HOST` | 0.0.0.0 | Bind address |
| `NODE_ENV` | development | Set to `production` when deployed |
| `MAX_FILE_SIZE` | 52428800 | Max upload bytes (50 MB) |
| `MAX_TEXT_LENGTH` | 100000 | Max pasted/typed text |
| `MAX_ITEMS_PER_ROOM` | 200 | Max items before oldest are trimmed |
| `ROOM_TTL` | 86400000 | Room expiry in ms (24h) |

## Known limitations (v1)

- **Ephemeral storage** — uploaded files live on disk; they are lost on server restart/redeploy (Render free tier). Fine for temporary sharing, not permanent storage.
- **In-memory rooms** — rooms reset when the server restarts. Auto-expire after 24h idle.
- **No encryption** — room codes are the only access control. Don't share sensitive data.
- **4-char codes** — ~1.6M combinations; rooms are temporary by design.

## Tech stack

- **Frontend:** React, Vite, Socket.io-client, qrcode
- **Backend:** Node.js, Express, Socket.io, Multer
- **Storage:** In-memory + local disk (no database)
