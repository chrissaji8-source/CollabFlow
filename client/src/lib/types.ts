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
  activeUsers?: number;
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

export interface Point {
  x: number;
  y: number;
}

export type ElementType = 'rectangle' | 'circle' | 'diamond' | 'arrow' | 'sticky' | 'draw' | 'text';

export interface WhiteboardElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor?: string;
  strokeWidth: number;
  text?: string;
  textColor?: string;
  fontSize?: number;
  points?: Point[]; // for freehand draw
  arrowEnd?: Point;
  zIndex: number;
  locked?: boolean;
  createdBy?: string;
  updatedBy?: string;
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

export interface CRDTStats {
  roomId: string;
  connectedSockets: number;
  activeAwarenessUsers: number;
  totalUpdatesProcessed: number;
  stateVectorLengthBytes: number;
  crdtClientsCount: number;
}
