# share2d

**Live link:** [https://share2d.onrender.com](https://share2d.onrender.com)

A simple browser-based sharing room. Open the same 4-character code on any two devices and instantly pass text, code, screenshots, and files between them - no login, no install, no setup.

---

## What is this?

share2d is a live shared clipboard. You create a room, get a short code (like `K4XQ`), open that same code on another device, and anything you paste or drop appears there in real time.

Think of it as a temporary bridge between devices - open the page, share a code, done.

---

## Why use it?

Most sharing tools get in the way. They need accounts, app installs, email verification, or a multi-step upload flow. share2d skips all of that.

| Problem | How share2d solves it |
|---|---|
| Can't install apps on a work machine | Runs entirely in the browser |
| USB, Bluetooth, or nearby share not available | Works over the internet via a URL |
| Email or Drive feels heavy for one snippet | Paste and it appears instantly |
| Need to test something on a phone from a laptop | QR code or room code - join in seconds |

---

## Who is it for?

- **Students and learners** doing courses on an office or college laptop with restrictions - send notes, code, or assignment files to your personal phone or home PC without installing anything
- **Developers** who want to quickly move a code snippet, error log, or screenshot from one machine to another
- **Anyone** who needs a fast handoff between phone and computer, or between two computers on different networks
- **People on locked-down devices** where you can't install LocalSend, Dropbox, or similar tools - if you have a browser, you have share2d

> **Note:** share2d is for temporary sharing, not storing sensitive data. Rooms auto-expire after 24 hours. Don't use it for passwords or private documents.

---

## Features

- **Create or join a room** with a 4-character code
- **Type text** in the bottom composer, or **paste** anywhere on the page
- **Paste images** - snip or screenshot on your device, then paste into the room
- **Attach files** - paperclip button on the left of the typing box
- **Drag and drop** files, images, PDFs, code files
- **Realtime sync** - every connected device sees updates immediately
- **QR code** to join from your phone in one scan
- **Copy** text, code, or images to clipboard
- **Delete items** or clear the whole room
- **Works on any device** - phone, tablet, laptop; any network
- **No account required** - open the link and start sharing
- **Theme toggle** - light or dark (dark by default; top-right; saved in your browser)

---

## How to use it

1. Go to [share2d.onrender.com](https://share2d.onrender.com)
2. Click **Create Room** - you get a code and a shareable link
3. On your other device, open the same link or enter the code
4. Type, paste, or drop files - they appear on every device in the room

**Shortcuts**

| Action | How |
|---|---|
| Send text | Type in the box, press Enter |
| New line | Shift + Enter |
| Paste text or image | Paste anywhere on the page (desktop), or into the typing box |
| Upload file | Paperclip in the typing box, drag onto the page, or paste a file |

---

## How it's built

share2d is a full-stack web app designed to be simple, fast, and free to run.

```
Browser (React)  ←--Socket.io--→  Node.js server
                                      ├── In-memory rooms (text, metadata)
                                      └── Disk storage (uploaded files)
```

| Layer | Tech |
|---|---|
| Frontend | React, Vite |
| Backend | Node.js, Express |
| Realtime | Socket.io |
| File uploads | Multer |
| Hosting | Render (free tier) |

**How data flows:**
- **Text and code** travel directly over WebSockets - instant, no upload step
- **Images and files** upload to the server, then sync to all devices in the room
- **Rooms expire** after 24 hours of inactivity; data is temporary by design

---

## Run locally (developers)

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001

```bash
npm run start:prod   # production build + serve on one port
```

---

## Limits

| | |
|---|---|
| Max file size | 50 MB |
| Max text length | ~100 KB |
| Room lifetime | 24 hours (inactive) |
| Access | Anyone with the room code |
