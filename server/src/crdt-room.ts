import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { PubSubService, PubSubMessage } from './pubsub.js';
import { StorageService } from './storage.js';
import { ChatMessage, LiveReaction } from './types.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_AUTH = 2;
const MESSAGE_CUSTOM_JSON = 99;

export class CRDTRoom {
  public id: string;
  public doc: Y.Doc;
  public awareness: awarenessProtocol.Awareness;
  public clients: Set<WebSocket> = new Set();
  private pubsub: PubSubService;
  private storage: StorageService;
  private unsubscribePubSub: (() => void) | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;
  public chatHistory: ChatMessage[] = [];
  public totalUpdatesProcessed = 0;

  constructor(id: string, pubsub: PubSubService, storage: StorageService) {
    this.id = id;
    this.pubsub = pubsub;
    this.storage = storage;

    // Create Y.Doc with unique client ID
    this.doc = new Y.Doc();

    // Create Awareness instance
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null);

    // Load persisted state if exists
    const persistedState = this.storage.loadDocState(id);
    if (persistedState) {
      try {
        Y.applyUpdate(this.doc, persistedState);
      } catch (e) {
        console.error(`[CRDTRoom ${id}] Failed to apply persisted state`, e);
      }
    }

    this.initListeners();
    this.initPubSub();
  }

  private initListeners() {
    // 1. Doc Update listener
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      this.totalUpdatesProcessed++;

      // Send to local WebSocket clients
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      this.clients.forEach((client) => {
        if (client !== origin && client.readyState === WebSocket.OPEN) {
          this.sendBinary(client, message);
        }
      });

      // Publish to Redis Pub/Sub if origin was NOT redis
      if (origin !== 'redis') {
        const base64Update = Buffer.from(update).toString('base64');
        this.pubsub.publish(this.id, {
          type: 'crdt_update',
          payload: base64Update,
        });
      }

      // Debounce saving to disk
      this.debouncedSave();
    });

    // 2. Awareness listener (Multiplayer cursors / user info)
    this.awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: any) => {
      const changedClients = added.concat(updated).concat(removed);
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(encoder, update);
      const message = encoding.toUint8Array(encoder);

      this.clients.forEach((client) => {
        if (client !== origin && client.readyState === WebSocket.OPEN) {
          this.sendBinary(client, message);
        }
      });

      // Publish to Redis Pub/Sub if origin was NOT redis
      if (origin !== 'redis') {
        const base64Awareness = Buffer.from(update).toString('base64');
        this.pubsub.publish(this.id, {
          type: 'awareness',
          payload: base64Awareness,
        });
      }
    });
  }

  private async initPubSub() {
    this.unsubscribePubSub = await this.pubsub.subscribe(this.id, (msg: PubSubMessage) => {
      if (msg.type === 'crdt_update') {
        try {
          const update = new Uint8Array(Buffer.from(msg.payload, 'base64'));
          Y.applyUpdate(this.doc, update, 'redis');
        } catch (e) {
          console.error(`[CRDTRoom ${this.id}] Error applying PubSub CRDT update`, e);
        }
      } else if (msg.type === 'awareness') {
        try {
          const awarenessUpdate = new Uint8Array(Buffer.from(msg.payload, 'base64'));
          awarenessProtocol.applyAwarenessUpdate(this.awareness, awarenessUpdate, 'redis');
        } catch (e) {
          console.error(`[CRDTRoom ${this.id}] Error applying PubSub Awareness update`, e);
        }
      } else if (msg.type === 'chat' || msg.type === 'reaction') {
        // Broadcast custom JSON to all local clients
        this.broadcastJson(JSON.parse(msg.payload));
      }
    });
  }

  private debouncedSave() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.storage.saveDocState(this.id, this.doc);
      this.saveTimeout = null;
    }, 1000);
  }

  public handleConnection(ws: WebSocket) {
    this.clients.add(ws);

    // 1. Send sync step 1 (Server sends its state vector to client)
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.sendBinary(ws, encoding.toUint8Array(encoder));

    // 2. Send current awareness states
    const awarenessStates = this.awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, Array.from(awarenessStates.keys()))
      );
      this.sendBinary(ws, encoding.toUint8Array(awarenessEncoder));
    }

    // 3. Send recent chat history
    if (this.chatHistory.length > 0) {
      ws.send(JSON.stringify({
        type: 'chat_history',
        messages: this.chatHistory.slice(-50),
      }));
    }

    // Message handler
    ws.on('message', (data: any, isBinary: boolean) => {
      try {
        if (isBinary || Buffer.isBuffer(data) || data instanceof Uint8Array || data instanceof ArrayBuffer) {
          const uint8 = new Uint8Array(data);
          this.handleBinaryMessage(ws, uint8);
        } else {
          const text = data.toString();
          this.handleTextMessage(ws, text);
        }
      } catch (err) {
        console.error(`[CRDTRoom ${this.id}] Error handling incoming message`, err);
      }
    });

    // Close handler
    ws.on('close', () => {
      this.clients.delete(ws);
      // Remove awareness state for this connection if any
      const controlledIds = (ws as any).controlledUserIds as Set<number> | undefined;
      if (controlledIds && controlledIds.size > 0) {
        awarenessProtocol.removeAwarenessStates(this.awareness, Array.from(controlledIds), ws);
      }
      if (this.clients.size === 0) {
        // Save state immediately on last client disconnect
        this.storage.saveDocState(this.id, this.doc);
      }
    });
  }

  private handleBinaryMessage(ws: WebSocket, message: Uint8Array) {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, this.doc, ws);
        if (encoding.length(encoder) > 1) {
          this.sendBinary(ws, encoding.toUint8Array(encoder));
        }
        break;
      }
      case MESSAGE_AWARENESS: {
        const update = decoding.readVarUint8Array(decoder);
        // Track client IDs controlled by this ws
        try {
          const rawChanges = (awarenessProtocol as any).decodeAwarenessUpdate?.(update);
          if (rawChanges?.added) {
            if (!(ws as any).controlledUserIds) (ws as any).controlledUserIds = new Set<number>();
            rawChanges.added.forEach((id: number) => (ws as any).controlledUserIds.add(id));
          }
        } catch (e) {
          // ignore
        }
        awarenessProtocol.applyAwarenessUpdate(this.awareness, update, ws);
        break;
      }
      case MESSAGE_AUTH: {
        // Auth token negotiation if needed
        break;
      }
      default:
        console.warn(`[CRDTRoom ${this.id}] Unknown binary message type: ${messageType}`);
    }
  }

  private handleTextMessage(ws: WebSocket, text: string) {
    try {
      const data = JSON.parse(text);

      if (data.type === 'chat_message') {
        const chatMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userId: data.userId || 'anon',
          userName: data.userName || 'Anonymous',
          userColor: data.userColor || '#3b82f6',
          userAvatar: data.userAvatar,
          content: data.content,
          timestamp: Date.now(),
          roomId: this.id,
        };

        this.chatHistory.push(chatMsg);
        if (this.chatHistory.length > 100) this.chatHistory.shift();

        // Broadcast locally
        this.broadcastJson({ type: 'new_chat_message', message: chatMsg });

        // Publish to Redis
        this.pubsub.publish(this.id, {
          type: 'chat',
          payload: JSON.stringify({ type: 'new_chat_message', message: chatMsg }),
        });
      } else if (data.type === 'reaction') {
        const reaction: LiveReaction = {
          id: `react-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          userId: data.userId || 'anon',
          userName: data.userName || 'Anonymous',
          emoji: data.emoji || '❤️',
          x: data.x || 0,
          y: data.y || 0,
          timestamp: Date.now(),
        };

        this.broadcastJson({ type: 'live_reaction', reaction });

        this.pubsub.publish(this.id, {
          type: 'reaction',
          payload: JSON.stringify({ type: 'live_reaction', reaction }),
        });
      } else if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', clientTime: data.clientTime, serverTime: Date.now() }));
      }
    } catch (e) {
      console.error(`[CRDTRoom ${this.id}] Error handling text message`, e);
    }
  }

  private sendBinary(ws: WebSocket, message: Uint8Array) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message, { binary: true });
    }
  }

  public broadcastJson(obj: any) {
    const raw = JSON.stringify(obj);
    this.clients.forEach((c) => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(raw);
      }
    });
  }

  public getCRDTStats() {
    const stateVector = Y.encodeStateVector(this.doc);
    const structCount = this.doc.store.clients.size;
    const clientCount = this.clients.size;
    const awarenessClients = this.awareness.getStates().size;

    return {
      roomId: this.id,
      connectedSockets: clientCount,
      activeAwarenessUsers: awarenessClients,
      totalUpdatesProcessed: this.totalUpdatesProcessed,
      stateVectorLengthBytes: stateVector.byteLength,
      crdtClientsCount: structCount,
    };
  }

  public destroy() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.storage.saveDocState(this.id, this.doc);
    }
    if (this.unsubscribePubSub) {
      this.unsubscribePubSub();
    }
    this.awareness.destroy();
    this.doc.destroy();
  }
}
