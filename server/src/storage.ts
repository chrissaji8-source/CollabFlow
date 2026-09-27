import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Y from 'yjs';
import { DocumentMetadata, VersionSnapshot } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const ROOMS_DIR = path.join(DATA_DIR, 'rooms');
const META_FILE = path.join(DATA_DIR, 'documents.json');
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ROOMS_DIR)) fs.mkdirSync(ROOMS_DIR, { recursive: true });
if (!fs.existsSync(VERSIONS_DIR)) fs.mkdirSync(VERSIONS_DIR, { recursive: true });

export class StorageService {
  private metadataMap: Map<string, DocumentMetadata> = new Map();

  constructor() {
    this.loadMetadata();
    this.seedDefaultsIfEmpty();
  }

  private loadMetadata() {
    if (fs.existsSync(META_FILE)) {
      try {
        const raw = fs.readFileSync(META_FILE, 'utf-8');
        const list: DocumentMetadata[] = JSON.parse(raw);
        list.forEach((meta) => this.metadataMap.set(meta.id, meta));
      } catch (e) {
        console.error('[Storage] Error loading metadata file, resetting map', e);
      }
    }
  }

  private saveMetadata() {
    try {
      const list = Array.from(this.metadataMap.values());
      fs.writeFileSync(META_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Storage] Error saving metadata file', e);
    }
  }

  public getAllDocuments(): DocumentMetadata[] {
    return Array.from(this.metadataMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public getDocument(id: string): DocumentMetadata | undefined {
    return this.metadataMap.get(id);
  }

  public createDocument(
    title: string,
    type: 'document' | 'whiteboard' = 'document',
    createdBy = 'Anonymous',
    icon = type === 'document' ? '📝' : '🎨'
  ): DocumentMetadata {
    const id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();
    const docMeta: DocumentMetadata = {
      id,
      title: title.trim() || (type === 'document' ? 'Untitled Document' : 'Untitled Whiteboard'),
      type,
      createdAt: now,
      updatedAt: now,
      createdBy,
      icon,
      tags: [type, 'realtime'],
    };

    this.metadataMap.set(id, docMeta);
    this.saveMetadata();
    return docMeta;
  }

  public updateDocumentMetadata(id: string, updates: Partial<DocumentMetadata>): DocumentMetadata | null {
    const existing = this.metadataMap.get(id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    this.metadataMap.set(id, updated);
    this.saveMetadata();
    return updated;
  }

  public deleteDocument(id: string): boolean {
    const removed = this.metadataMap.delete(id);
    if (removed) {
      this.saveMetadata();
      const roomFile = path.join(ROOMS_DIR, `${id}.bin`);
      if (fs.existsSync(roomFile)) {
        fs.unlinkSync(roomFile);
      }
      const versionsFile = path.join(VERSIONS_DIR, `${id}.json`);
      if (fs.existsSync(versionsFile)) {
        fs.unlinkSync(versionsFile);
      }
    }
    return removed;
  }

  public loadDocState(roomId: string): Uint8Array | null {
    const roomFile = path.join(ROOMS_DIR, `${roomId}.bin`);
    if (fs.existsSync(roomFile)) {
      try {
        return new Uint8Array(fs.readFileSync(roomFile));
      } catch (e) {
        console.error(`[Storage] Failed to read doc state for ${roomId}`, e);
      }
    }
    return null;
  }

  public saveDocState(roomId: string, ydoc: Y.Doc): void {
    const roomFile = path.join(ROOMS_DIR, `${roomId}.bin`);
    try {
      const state = Y.encodeStateAsUpdate(ydoc);
      fs.writeFileSync(roomFile, Buffer.from(state));

      // update timestamp in metadata
      const meta = this.metadataMap.get(roomId);
      if (meta) {
        meta.updatedAt = Date.now();
        this.saveMetadata();
      }
    } catch (e) {
      console.error(`[Storage] Failed to save doc state for ${roomId}`, e);
    }
  }

  public getVersions(roomId: string): VersionSnapshot[] {
    const versionsFile = path.join(VERSIONS_DIR, `${roomId}.json`);
    if (fs.existsSync(versionsFile)) {
      try {
        return JSON.parse(fs.readFileSync(versionsFile, 'utf-8'));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  public createVersion(
    roomId: string,
    name: string,
    createdBy: string,
    ydoc: Y.Doc,
    description?: string
  ): VersionSnapshot {
    const versions = this.getVersions(roomId);
    const update = Y.encodeStateAsUpdate(ydoc);
    const base64 = Buffer.from(update).toString('base64');
    
    const snapshot: VersionSnapshot = {
      id: `v-${Date.now()}`,
      roomId,
      versionNumber: versions.length + 1,
      name: name || `Version ${versions.length + 1}`,
      createdAt: Date.now(),
      createdBy: createdBy || 'Anonymous',
      description,
      docUpdateBase64: base64,
      sizeBytes: update.byteLength,
    };

    versions.unshift(snapshot);
    const versionsFile = path.join(VERSIONS_DIR, `${roomId}.json`);
    fs.writeFileSync(versionsFile, JSON.stringify(versions, null, 2), 'utf-8');
    return snapshot;
  }

  private seedDefaultsIfEmpty() {
    if (this.metadataMap.size > 0) return;

    console.log('\x1b[36m[Storage]\x1b[0m Seeding default collaborative documents and whiteboards...');

    // 1. Interactive Architecture Document
    const doc1 = this.createDocument('🚀 Real-Time Collaborative Architecture', 'document', 'System Architect', '🚀');
    const ydoc1 = new Y.Doc();
    const ytext1 = ydoc1.getText('default');
    
    // Seed initial TipTap / ProseMirror collaborative JSON structure in Y.XmlFragment or Y.Text
    const initialDocContent = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Real-Time Collaborative System ⚡' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Welcome to the ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'Enterprise Real-Time Collaborative Suite' },
            { type: 'text', text: '! This system uses ' },
            { type: 'text', marks: [{ type: 'code' }], text: 'Yjs CRDTs' },
            { type: 'text', text: ', ' },
            { type: 'text', marks: [{ type: 'code' }], text: 'WebSockets' },
            { type: 'text', text: ', and ' },
            { type: 'text', marks: [{ type: 'code' }], text: 'Redis Pub/Sub' },
            { type: 'text', text: ' to provide zero-conflict concurrent editing across millions of simultaneous operations.' }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Key Architectural Concepts' }]
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'CRDT Mathematical Convergence (Commutative & Associative operations)' }] }]
            },
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Awareness Protocol (Multiplayer Cursors & Selection Highlighting)' }] }]
            },
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Optimistic UI Updates with Offline Catchup & Reconnection' }] }]
            },
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Redis Pub/Sub Distributed Room Fanout for Horizontal Scaling' }] }]
            }
          ]
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'How to Test Real-Time Collaboration' }]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '1. Click the ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '👥 Split-Screen Multi-User Sandbox' },
            { type: 'text', text: ' button in the top navigation bar to open 2 or 3 live side-by-side editing panes.' }
          ]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '2. Type in one window and notice the instantaneous character streaming and multiplayer caret movement.' }
          ]
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '3. Open the ' },
            { type: 'text', marks: [{ type: 'bold' }], text: '🔬 CRDT State Inspector' },
            { type: 'text', text: ' to observe the internal StructStore, State Vector, and simulated network lag toggles.' }
          ]
        }
      ]
    });
    
    // Save binary state
    const ymap1 = ydoc1.getMap('doc_meta');
    ymap1.set('title', doc1.title);
    ymap1.set('initialContent', initialDocContent);
    this.saveDocState(doc1.id, ydoc1);

    // 2. Interactive Whiteboard
    const wb1 = this.createDocument('🎨 System Architecture Whiteboard', 'whiteboard', 'Lead Designer', '🎨');
    const ydoc2 = new Y.Doc();
    const yelements = ydoc2.getArray('elements');

    const defaultElements = [
      {
        id: 'node-1',
        type: 'rectangle',
        x: 120,
        y: 100,
        width: 220,
        height: 120,
        strokeColor: '#3b82f6',
        backgroundColor: '#1e3a8a33',
        strokeWidth: 2,
        text: 'Client (React + Yjs)\n- Local CRDT Doc\n- Optimistic UI\n- Multiplayer Cursors',
        textColor: '#93c5fd',
        fontSize: 14,
        zIndex: 1,
      },
      {
        id: 'node-2',
        type: 'rectangle',
        x: 460,
        y: 100,
        width: 220,
        height: 120,
        strokeColor: '#10b981',
        backgroundColor: '#064e3b33',
        strokeWidth: 2,
        text: 'WebSocket Gateway\n- Room Multiplexer\n- Awareness Broker\n- Binary Sync Protocol',
        textColor: '#6ee7b7',
        fontSize: 14,
        zIndex: 2,
      },
      {
        id: 'node-3',
        type: 'rectangle',
        x: 800,
        y: 100,
        width: 220,
        height: 120,
        strokeColor: '#ef4444',
        backgroundColor: '#7f1d1d33',
        strokeWidth: 2,
        text: 'Redis Pub/Sub Bus\n- Multi-server sync\n- Ephemeral state\n- Room channel broadcast',
        textColor: '#fca5a5',
        fontSize: 14,
        zIndex: 3,
      },
      {
        id: 'node-4',
        type: 'sticky',
        x: 280,
        y: 280,
        width: 200,
        height: 160,
        strokeColor: '#f59e0b',
        backgroundColor: '#78350f44',
        strokeWidth: 1,
        text: '💡 Tip: Try drawing with the Pen tool or dropping sticky notes in real-time!',
        textColor: '#fde68a',
        fontSize: 14,
        zIndex: 4,
      },
      {
        id: 'arrow-1',
        type: 'arrow',
        x: 340,
        y: 160,
        width: 120,
        height: 0,
        strokeColor: '#60a5fa',
        strokeWidth: 3,
        text: 'WebSockets',
        textColor: '#93c5fd',
        zIndex: 5,
      },
      {
        id: 'arrow-2',
        type: 'arrow',
        x: 680,
        y: 160,
        width: 120,
        height: 0,
        strokeColor: '#34d399',
        strokeWidth: 3,
        text: 'Pub/Sub',
        textColor: '#6ee7b7',
        zIndex: 6,
      }
    ];

    yelements.push(defaultElements);
    this.saveDocState(wb1.id, ydoc2);
  }
}
