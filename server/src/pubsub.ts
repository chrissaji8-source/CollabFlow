import { EventEmitter } from 'node:events';
import Redis from 'ioredis';

export interface PubSubMessage {
  roomId: string;
  type: 'crdt_update' | 'awareness' | 'chat' | 'reaction' | 'room_event';
  senderId?: string;
  payload: string; // Base64 or JSON
  timestamp: number;
}

export class PubSubService extends EventEmitter {
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private isRedisActive = false;
  private memoryBus = new EventEmitter();
  private redisUrl: string | undefined;
  private stats = {
    messagesPublished: 0,
    messagesReceived: 0,
    activeSubscriptions: new Set<string>(),
  };

  constructor(redisUrl?: string) {
    super();
    this.redisUrl = redisUrl || process.env.REDIS_URL;
    this.initRedis();
  }

  private initRedis() {
    if (!this.redisUrl) {
      console.log('\x1b[33m[PubSub]\x1b[0m No REDIS_URL provided. Running with high-performance In-Memory PubSub Bus.');
      return;
    }

    try {
      this.pubClient = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) {
            return null; // stop reconnecting if redis is not running
          }
          return Math.min(times * 1000, 3000);
        },
        lazyConnect: true,
      });

      this.subClient = new Redis(this.redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 1000, 3000);
        },
        lazyConnect: true,
      });

      this.pubClient.connect().then(() => {
        console.log('\x1b[32m[PubSub]\x1b[0m Connected to Redis Publisher successfully');
      }).catch((err) => {
        console.log('\x1b[33m[PubSub]\x1b[0m Redis Publisher connection failed, falling back to In-Memory PubSub:', err.message);
        this.pubClient = null;
      });

      this.subClient.connect().then(() => {
        this.isRedisActive = true;
        console.log('\x1b[32m[PubSub]\x1b[0m Connected to Redis Subscriber successfully');
        
        this.subClient?.on('message', (channel, message) => {
          this.stats.messagesReceived++;
          try {
            const parsed: PubSubMessage = JSON.parse(message);
            this.emit(channel, parsed);
          } catch (e) {
            console.error('[PubSub] Failed to parse Redis message', e);
          }
        });
      }).catch((err) => {
        console.log('\x1b[33m[PubSub]\x1b[0m Redis Subscriber connection failed, using In-Memory PubSub:', err.message);
        this.subClient = null;
        this.isRedisActive = false;
      });

    } catch (err: any) {
      console.log('\x1b[33m[PubSub]\x1b[0m Redis init error, defaulting to In-Memory:', err.message);
      this.isRedisActive = false;
    }
  }

  public async publish(roomId: string, message: Omit<PubSubMessage, 'roomId' | 'timestamp'>): Promise<void> {
    const fullMsg: PubSubMessage = {
      ...message,
      roomId,
      timestamp: Date.now(),
    };
    this.stats.messagesPublished++;

    const channel = `collab:room:${roomId}`;
    const stringified = JSON.stringify(fullMsg);

    if (this.isRedisActive && this.pubClient) {
      try {
        await this.pubClient.publish(channel, stringified);
      } catch (err) {
        // fallback to memory
        this.memoryBus.emit(channel, fullMsg);
      }
    } else {
      this.memoryBus.emit(channel, fullMsg);
    }
  }

  public async subscribe(roomId: string, listener: (msg: PubSubMessage) => void): Promise<() => void> {
    const channel = `collab:room:${roomId}`;
    this.stats.activeSubscriptions.add(roomId);

    if (this.isRedisActive && this.subClient) {
      try {
        await this.subClient.subscribe(channel);
        const onRedisMsg = (msg: PubSubMessage) => listener(msg);
        this.on(channel, onRedisMsg);

        return async () => {
          this.off(channel, onRedisMsg);
          this.stats.activeSubscriptions.delete(roomId);
          if (this.subClient) {
            await this.subClient.unsubscribe(channel).catch(() => {});
          }
        };
      } catch (err) {
        // fallback
      }
    }

    const onMemoryMsg = (msg: PubSubMessage) => listener(msg);
    this.memoryBus.on(channel, onMemoryMsg);

    return () => {
      this.stats.activeSubscriptions.delete(roomId);
      this.memoryBus.off(channel, onMemoryMsg);
    };
  }

  public getStatus() {
    return {
      isRedisActive: this.isRedisActive,
      mode: this.isRedisActive ? ('redis' as const) : ('in-memory' as const),
      messagesPublished: this.stats.messagesPublished,
      messagesReceived: this.stats.messagesReceived,
      activeChannels: this.stats.activeSubscriptions.size,
    };
  }
}
