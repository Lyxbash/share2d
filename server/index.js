import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || String(50 * 1024 * 1024), 10);
const MAX_TEXT_LENGTH = parseInt(process.env.MAX_TEXT_LENGTH || '100000', 10);
const MAX_ITEMS_PER_ROOM = parseInt(process.env.MAX_ITEMS_PER_ROOM || '200', 10);
const ROOM_TTL = parseInt(process.env.ROOM_TTL || String(24 * 60 * 60 * 1000), 10);
const ROOM_CODE_REGEX = /^[A-Z0-9]{4}$/;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateCode() : code;
}

function touchRoom(room) {
  room.lastActive = Date.now();
}

function isCode(text) {
  if (text.trim().split('\n').length < 2) return false;
  const codeIndicators = ['function', 'const', 'let', 'var', 'import', 'export', 'class', 'def ', 'public ', 'private ', '#include', '<?php', '<!DOCTYPE', '{', '=>', 'console.log'];
  return codeIndicators.some((ind) => text.includes(ind));
}

function createItem(type, data) {
  return { id: uuidv4(), type, ...data, timestamp: Date.now() };
}

function sanitizeItemForClient(item) {
  const { filePath, senderId, ...clientItem } = item;
  return clientItem;
}

function sanitizeItemsForClient(items) {
  return items.map(sanitizeItemForClient);
}

function trimRoomItems(room) {
  while (room.items.length > MAX_ITEMS_PER_ROOM) {
    const removed = room.items.pop();
    if (removed?.filePath && fs.existsSync(removed.filePath)) fs.unlinkSync(removed.filePath);
  }
}

function cleanupRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  for (const item of room.items) {
    if (item.filePath && fs.existsSync(item.filePath)) fs.unlinkSync(item.filePath);
  }
  rooms.delete(code);
}

function cleanupStaleRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActive > ROOM_TTL) cleanupRoom(code);
  }
}

setInterval(cleanupStaleRooms, 60 * 60 * 1000);

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);

const io = new Server(httpServer, {
  cors: { origin: NODE_ENV === 'production' ? false : '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size, uptime: process.uptime() });
});

app.post('/api/rooms', (_req, res) => {
  const code = generateCode();
  rooms.set(code, { items: [], lastActive: Date.now(), sockets: new Set() });
  res.json({ code });
});

app.get('/api/rooms/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!ROOM_CODE_REGEX.test(code)) return res.status(400).json({ error: 'Invalid room code' });

  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  touchRoom(room);
  res.json({ code, items: sanitizeItemsForClient(room.items) });
});

app.post('/api/rooms/:code/files', (req, res) => {
  const code = req.params.code.toUpperCase();
  if (!ROOM_CODE_REGEX.test(code)) return res.status(400).json({ error: 'Invalid room code' });

  const room = rooms.get(code);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    touchRoom(room);
    const safeName = path.basename(req.file.originalname).replace(/[^\w.\-() ]/g, '_').slice(0, 200);
    const isImage = req.file.mimetype.startsWith('image/');
    const item = createItem(isImage ? 'image' : 'file', {
      filename: safeName || 'upload',
      mimeType: req.file.mimetype,
      size: req.file.size,
      fileId: path.basename(req.file.filename, path.extname(req.file.filename)),
      filePath: req.file.path,
      url: `/files/${req.file.filename}`,
    });

    room.items.unshift(item);
    trimRoomItems(room);
    io.to(code).emit('item', { ...sanitizeItemForClient(item), senderId: req.headers['x-socket-id'] || null });
    res.json(sanitizeItemForClient(item));
  });
});

app.get('/files/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (filename !== req.params.filename) return res.status(400).send('Invalid filename');

  const filePath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  for (const room of rooms.values()) {
    const item = room.items.find((i) => i.url === `/files/${filename}`);
    if (item) {
      res.setHeader('Content-Type', item.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${item.filename}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.sendFile(filePath);
    }
  }

  res.status(404).send('Not found');
});

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('join', (rawCode) => {
    const code = String(rawCode || '').toUpperCase();
    if (!ROOM_CODE_REGEX.test(code)) {
      socket.emit('error', { message: 'Invalid room code' });
      return;
    }

    let room = rooms.get(code);
    if (!room) {
      room = { items: [], lastActive: Date.now(), sockets: new Set() };
      rooms.set(code, room);
    }

    if (currentRoom) {
      const prev = rooms.get(currentRoom);
      prev?.sockets.delete(socket.id);
    }

    currentRoom = code;
    socket.join(code);
    room.sockets.add(socket.id);
    touchRoom(room);

    socket.emit('history', sanitizeItemsForClient(room.items));
    io.to(code).emit('presence', room.sockets.size);
  });

  socket.on('text', ({ text }) => {
    if (!currentRoom || !text?.trim()) return;
    if (text.length > MAX_TEXT_LENGTH) {
      socket.emit('error', { message: `Text too long (max ${MAX_TEXT_LENGTH} chars)` });
      return;
    }

    const room = rooms.get(currentRoom);
    if (!room) return;

    touchRoom(room);
    const item = createItem(isCode(text) ? 'code' : 'text', { content: text });
    room.items.unshift(item);
    trimRoomItems(room);
    io.to(currentRoom).emit('item', { ...sanitizeItemForClient(item), senderId: socket.id });
  });

  socket.on('delete', ({ id }) => {
    if (!currentRoom || !id) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const idx = room.items.findIndex((i) => i.id === id);
    if (idx === -1) return;

    const [removed] = room.items.splice(idx, 1);
    if (removed.filePath && fs.existsSync(removed.filePath)) fs.unlinkSync(removed.filePath);
    touchRoom(room);
    io.to(currentRoom).emit('item-deleted', { id });
  });

  socket.on('clear-all', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    for (const item of room.items) {
      if (item.filePath && fs.existsSync(item.filePath)) fs.unlinkSync(item.filePath);
    }
    room.items = [];
    touchRoom(room);
    io.to(currentRoom).emit('cleared');
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    room.sockets.delete(socket.id);
    io.to(currentRoom).emit('presence', room.sockets.size);
  });
});

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { maxAge: NODE_ENV === 'production' ? '1d' : 0 }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/files') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`share2d [${NODE_ENV}] running on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});
