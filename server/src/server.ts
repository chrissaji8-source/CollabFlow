import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { PubSubService } from './pubsub.js';
import { StorageService } from './storage.js';
import { CRDTRoom } from './crdt-room.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const pubsub = new PubSubService();
const storage = new StorageService();
const rooms = new Map<string, CRDTRoom>();

function getOrCreateRoom(roomId: string): CRDTRoom {
  let room = rooms.get(roomId);
  if (!room) {
    room = new CRDTRoom(roomId, pubsub, storage);
    rooms.set(roomId, room);
    console.log(`\x1b[35m[Room Manager]\x1b[0m Initialized room: ${roomId}`);
  }
  return room;
}

// WebSocket Server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', `http://${request.headers.host}`);
  const pathname = url.pathname;

  // Match /ws/:roomId or /:roomId
  let roomId = pathname.replace(/^\/ws\/?/, '').replace(/^\//, '');
  if (!roomId) {
    roomId = 'default-room';
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, roomId);
  });
});

wss.on('connection', (ws: WebSocket, request: http.IncomingMessage, roomId: string) => {
  console.log(`\x1b[32m[WS Connection]\x1b[0m Client connected to room: ${roomId}`);
  const room = getOrCreateRoom(roomId);
  room.handleConnection(ws);
});

// REST API Endpoints

// 1. Get all documents
app.get('/api/documents', (req, res) => {
  const docs = storage.getAllDocuments();
  const enriched = docs.map((doc) => {
    const room = rooms.get(doc.id);
    return {
      ...doc,
      activeUsers: room ? room.awareness.getStates().size : 0,
    };
  });
  res.json({ documents: enriched });
});

// 2. Create document
app.post('/api/documents', (req, res) => {
  const { title, type, createdBy, icon } = req.body;
  const doc = storage.createDocument(title, type, createdBy, icon);
  res.status(201).json({ document: doc });
});

// 3. Get single document
app.get('/api/documents/:id', (req, res) => {
  const doc = storage.getDocument(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }
  const room = rooms.get(doc.id);
  res.json({
    document: {
      ...doc,
      activeUsers: room ? room.awareness.getStates().size : 0,
    },
  });
});

// 4. Update document metadata
app.patch('/api/documents/:id', (req, res) => {
  const updated = storage.updateDocumentMetadata(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json({ document: updated });
});

// 5. Delete document
app.delete('/api/documents/:id', (req, res) => {
  const roomId = req.params.id;
  const room = rooms.get(roomId);
  if (room) {
    room.destroy();
    rooms.delete(roomId);
  }
  const success = storage.deleteDocument(roomId);
  if (!success) {
    return res.status(404).json({ error: 'Document not found' });
  }
  res.json({ success: true, message: 'Document deleted' });
});

// 6. Get version history
app.get('/api/documents/:id/versions', (req, res) => {
  const versions = storage.getVersions(req.params.id);
  res.json({ versions });
});

// 7. Create named snapshot version
app.post('/api/documents/:id/versions', (req, res) => {
  const { name, createdBy, description } = req.body;
  const roomId = req.params.id;
  const room = getOrCreateRoom(roomId);
  const snapshot = storage.createVersion(roomId, name, createdBy, room.doc, description);
  res.status(201).json({ version: snapshot });
});

// 8. Restore version snapshot
app.post('/api/documents/:id/restore', (req, res) => {
  const { versionId } = req.body;
  const roomId = req.params.id;
  const versions = storage.getVersions(roomId);
  const version = versions.find((v) => v.id === versionId);

  if (!version) {
    return res.status(404).json({ error: 'Version snapshot not found' });
  }

  const room = getOrCreateRoom(roomId);
  try {
    const update = new Uint8Array(Buffer.from(version.docUpdateBase64, 'base64'));
    // Clear and re-apply or apply as new state
    Y.applyUpdate(room.doc, update, 'restore');
    storage.saveDocState(roomId, room.doc);

    // Notify all connected clients in the room
    room.broadcastJson({
      type: 'version_restored',
      versionName: version.name,
      timestamp: Date.now(),
    });

    res.json({ success: true, message: `Restored to ${version.name}` });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to restore version: ${err.message}` });
  }
});

// 9. Inspect CRDT internal structure
app.get('/api/documents/:id/crdt-inspect', (req, res) => {
  const roomId = req.params.id;
  const room = getOrCreateRoom(roomId);
  const crdtStats = room.getCRDTStats();

  const doc = room.doc;
  const clientIds = Array.from(doc.store.clients.keys());
  const structsByClient: Record<string, number> = {};
  clientIds.forEach((cid) => {
    structsByClient[cid.toString()] = doc.store.clients.get(cid)?.length || 0;
  });

  res.json({
    crdtStats,
    clientIds,
    structsByClient,
    stateVectorBase64: Buffer.from(Y.encodeStateVector(doc)).toString('base64'),
    totalBytes: Buffer.from(Y.encodeStateAsUpdate(doc)).byteLength,
  });
});

// 10. Export document
app.get('/api/documents/:id/export', (req, res) => {
  const roomId = req.params.id;
  const docMeta = storage.getDocument(roomId);
  if (!docMeta) return res.status(404).json({ error: 'Document not found' });

  const room = getOrCreateRoom(roomId);
  const format = req.query.format || 'json';

  if (docMeta.type === 'document') {
    const ytext = room.doc.getText('default');
    const ymap = room.doc.getMap('doc_meta');

    if (format === 'markdown' || format === 'text') {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${docMeta.title}.md"`);
      return res.send(ytext.toString() || `# ${docMeta.title}\n\nDocument contents exported.`);
    }
  }

  // JSON export
  const update = Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString('base64');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${docMeta.title}.json"`);
  res.json({
    metadata: docMeta,
    crdtUpdateBase64: update,
    exportedAt: Date.now(),
  });
});

// 11. System Stats & Redis status
app.get('/api/stats', (req, res) => {
  const pubsubStatus = pubsub.getStatus();
  let totalActiveSockets = 0;
  rooms.forEach((r) => {
    totalActiveSockets += r.clients.size;
  });

  const memory = process.memoryUsage();

  res.json({
    activeRooms: rooms.size,
    totalConnectedClients: totalActiveSockets,
    pubsub: pubsubStatus,
    memoryUsageMb: Math.round(memory.heapUsed / 1024 / 1024),
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
  });
});

// Start Server
server.listen(PORT, () => {
  console.log('\x1b[32m%s\x1b[0m', `=====================================================`);
  console.log('\x1b[32m%s\x1b[0m', ` 🌐 Collab Server listening on http://localhost:${PORT}`);
  console.log('\x1b[32m%s\x1b[0m', ` ⚡ WebSocket Gateway ready on ws://localhost:${PORT}/ws/:roomId`);
  console.log('\x1b[32m%s\x1b[0m', ` 📦 CRDT Engine: Yjs v13 with Binary Sync & Awareness`);
  console.log('\x1b[32m%s\x1b[0m', `=====================================================`);
});

// Graceful exit
function handleExit() {
  console.log('\n[Server] Saving all active room states before shutdown...');
  rooms.forEach((room) => {
    storage.saveDocState(room.id, room.doc);
  });
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
