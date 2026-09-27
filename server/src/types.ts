export type DocType = 'document' | 'whiteboard';

export interface DocumentMetadata {
  id: string;
  title: string;
  type: DocType;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  icon?: string;
  tags?: string[];
  thumbnail?: string;
}

export interface UserPresence {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  cursor?: {
    x?: number;
    y?: number;
    anchor?: number;
    head?: number;
    line?: number;
    col?: number;
    nodeId?: string;
  };
  activeElement?: string;
  isTyping?: boolean;
  lastActive: number;
  status: 'online' | 'idle' | 'offline';
  device?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  userAvatar?: string;
  content: string;
  timestamp: number;
  roomId: string;
}

export interface LiveReaction {
  id: string;
  userId: string;
  userName: string;
  emoji: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface VersionSnapshot {
  id: string;
  roomId: string;
  versionNumber: number;
  name: string;
  createdAt: number;
  createdBy: string;
  description?: string;
  docUpdateBase64: string;
  sizeBytes: number;
}

export interface ServerStats {
  activeRooms: number;
  connectedClients: number;
  pubSubMode: 'redis' | 'in-memory';
  redisConnected: boolean;
  totalMessagesProcessed: number;
  uptimeSeconds: number;
  memoryUsageMb: number;
}
