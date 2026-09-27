import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { UserProfile } from '../utils/user.js';
import { UserPresence, ChatMessage, LiveReaction } from '../types.js';

export interface UseYjsRoomOptions {
  roomId: string;
  user: UserProfile;
  simulatedDelayMs?: number;
}

export function useYjsRoom({ roomId, user, simulatedDelayMs = 0 }: UseYjsRoomOptions) {
  // Yjs doc per room
  const ydoc = useMemo(() => new Y.Doc(), [roomId]);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'offline' | 'syncing'>('connecting');
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeReactions, setActiveReactions] = useState<LiveReaction[]>([]);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const pingIntervalRef = useRef<any>(null);

  const wsUrl = useMemo(() => {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // Port 4000 for backend WS
    const host = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1'
      ? `${loc.hostname}:4000`
      : loc.host;
    return `${protocol}//${host}/ws`;
  }, []);

  useEffect(() => {
    let active = true;
    setSyncStatus('connecting');

    // Initialize WebsocketProvider
    const wsProvider = new WebsocketProvider(wsUrl, roomId, ydoc, {
      connect: true,
      maxBackoffTime: 2500,
    });

    setProvider(wsProvider);

    // Update awareness local state
    wsProvider.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name,
      color: user.color,
      avatar: user.avatar,
      lastActive: Date.now(),
      status: 'online',
    });

    const handleStatus = (event: { status: 'connecting' | 'connected' | 'disconnected' }) => {
      if (!active) return;
      if (event.status === 'connected') {
        setSyncStatus('connected');
      } else if (event.status === 'connecting') {
        setSyncStatus('syncing');
      } else {
        setSyncStatus('offline');
      }
    };

    const handleSync = (isSynced: boolean) => {
      if (!active) return;
      if (isSynced) {
        setSyncStatus('connected');
      } else {
        setSyncStatus('syncing');
      }
    };

    const handleAwarenessChange = () => {
      if (!active) return;
      const states = wsProvider.awareness.getStates();
      const users: UserPresence[] = [];

      states.forEach((state: any, clientID: number) => {
        if (state.user) {
          users.push({
            id: state.user.id || `client-${clientID}`,
            name: state.user.name || 'Anonymous',
            color: state.user.color || '#3b82f6',
            avatar: state.user.avatar,
            cursor: state.cursor,
            activeElement: state.activeElement,
            isTyping: state.isTyping,
            lastActive: state.user.lastActive || Date.now(),
            status: state.user.status || 'online',
          });
        }
      });

      setOnlineUsers(users);
    };

    wsProvider.on('status', handleStatus);
    wsProvider.on('sync', handleSync);
    wsProvider.awareness.on('change', handleAwarenessChange);

    // Custom text message listener for chat and reactions
    const handleWsMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_history') {
            setChatMessages(data.messages || []);
          } else if (data.type === 'new_chat_message') {
            setChatMessages((prev) => [...prev, data.message]);
          } else if (data.type === 'live_reaction') {
            setActiveReactions((prev) => [...prev, data.reaction]);
            setTimeout(() => {
              setActiveReactions((prev) => prev.filter((r) => r.id !== data.reaction.id));
            }, 2000);
          } else if (data.type === 'pong') {
            const now = Date.now();
            const rtt = Math.max(1, now - data.clientTime);
            setLatencyMs(rtt);
          }
        } catch (e) {
          // ignore non-json
        }
      }
    };

    const ws = wsProvider.ws;
    if (ws) {
      ws.addEventListener('message', handleWsMessage);
    }

    // Ping interval for RTT calculation
    pingIntervalRef.current = setInterval(() => {
      if (wsProvider.ws && wsProvider.ws.readyState === WebSocket.OPEN) {
        wsProvider.ws.send(JSON.stringify({ type: 'ping', clientTime: Date.now() }));
      }
    }, 4000);

    return () => {
      active = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsProvider.ws) {
        wsProvider.ws.removeEventListener('message', handleWsMessage);
      }
      wsProvider.off('status', handleStatus);
      wsProvider.off('sync', handleSync);
      wsProvider.awareness.off('change', handleAwarenessChange);
      wsProvider.destroy();
      ydoc.destroy();
    };
  }, [roomId, ydoc, wsUrl]);

  // Update awareness user info if user prop changes
  useEffect(() => {
    if (provider && provider.awareness) {
      provider.awareness.setLocalStateField('user', {
        id: user.id,
        name: user.name,
        color: user.color,
        avatar: user.avatar,
        lastActive: Date.now(),
        status: 'online',
      });
    }
  }, [provider, user]);

  // Send Cursor Position Update
  const updateCursor = useCallback((cursor: { x?: number; y?: number; nodeId?: string; line?: number; col?: number }) => {
    if (provider && provider.awareness) {
      provider.awareness.setLocalStateField('cursor', cursor);
    }
  }, [provider]);

  // Send Typing Indicator
  const setTyping = useCallback((isTyping: boolean) => {
    if (provider && provider.awareness) {
      provider.awareness.setLocalStateField('isTyping', isTyping);
    }
  }, [provider]);

  // Send Chat Message
  const sendChatMessage = useCallback((content: string) => {
    if (!content.trim() || !provider?.ws || provider.ws.readyState !== WebSocket.OPEN) return;
    const msg = {
      type: 'chat_message',
      userId: user.id,
      userName: user.name,
      userColor: user.color,
      userAvatar: user.avatar,
      content: content.trim(),
    };
    provider.ws.send(JSON.stringify(msg));
  }, [provider, user]);

  // Send Live Reaction (Figma style)
  const sendReaction = useCallback((emoji: string, x: number = 0, y: number = 0) => {
    if (!provider?.ws || provider.ws.readyState !== WebSocket.OPEN) return;
    const react = {
      type: 'reaction',
      userId: user.id,
      userName: user.name,
      emoji,
      x,
      y,
    };
    provider.ws.send(JSON.stringify(react));

    // Also trigger local instant reaction (optimistic UI update)
    const localReact: LiveReaction = {
      id: `local-${Date.now()}-${Math.random()}`,
      userId: user.id,
      userName: user.name,
      emoji,
      x,
      y,
      timestamp: Date.now(),
    };
    setActiveReactions((prev) => [...prev, localReact]);
    setTimeout(() => {
      setActiveReactions((prev) => prev.filter((r) => r.id !== localReact.id));
    }, 2000);
  }, [provider, user]);

  return {
    ydoc,
    provider,
    syncStatus,
    onlineUsers,
    chatMessages,
    activeReactions,
    latencyMs,
    updateCursor,
    setTyping,
    sendChatMessage,
    sendReaction,
  };
}
