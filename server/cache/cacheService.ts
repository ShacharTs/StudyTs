import net from 'net';
import { log } from '../utils/log.js';

interface CacheAdapter {
  readonly type: 'memory' | 'redis';
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryCacheAdapter implements CacheAdapter {
  public readonly type = 'memory';
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  public async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  public async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async clear(): Promise<void> {
    this.store.clear();
  }
}

/**
 * Lightweight native TCP client for Redis (RESP protocol).
 * Zero external npm dependencies.
 */
export class RedisCacheAdapter implements CacheAdapter {
  public readonly type = 'redis';
  private host: string;
  private port: number;
  private isConnected = false;
  private inMemoryFallback = new InMemoryCacheAdapter();

  public get isReady(): boolean {
    return this.isConnected;
  }

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://127.0.0.1:6379') {
    try {
      const url = new URL(redisUrl);
      this.host = url.hostname || '127.0.0.1';
      this.port = Number(url.port) || 6379;
    } catch {
      this.host = '127.0.0.1';
      this.port = 6379;
    }
  }

  private sendCommand(command: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host: this.host, port: this.port, timeout: 500 });
      let response = '';

      socket.on('connect', () => {
        this.isConnected = true;
        // Build RESP array
        let resp = `*${command.length}\r\n`;
        for (const arg of command) {
          const str = String(arg);
          resp += `$${Buffer.byteLength(str, 'utf8')}\r\n${str}\r\n`;
        }
        socket.write(resp);
      });

      socket.on('data', (chunk) => {
        response += chunk.toString('utf8');
        socket.end();
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(null);
      });

      socket.on('error', () => {
        this.isConnected = false;
        resolve(null);
      });

      socket.on('close', () => {
        if (!response) {
          resolve(null);
          return;
        }
        // Parse simple RESP response
        if (response.startsWith('+') || response.startsWith(':')) {
          resolve(response.slice(1).trim());
        } else if (response.startsWith('$')) {
          const lines = response.split('\r\n');
          const length = Number(lines[0].slice(1));
          if (length === -1) {
            resolve(null);
          } else {
            resolve(lines[1] || null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.sendCommand(['GET', key]);
      if (raw !== null) {
        return JSON.parse(raw) as T;
      }
    } catch {
      // Fallback
    }
    return this.inMemoryFallback.get<T>(key);
  }

  public async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    const json = JSON.stringify(value);
    try {
      await this.sendCommand(['SETEX', key, String(ttlSeconds), json]);
    } catch {
      // Fallback
    }
    await this.inMemoryFallback.set<T>(key, value, ttlSeconds);
  }

  public async delete(key: string): Promise<void> {
    try {
      await this.sendCommand(['DEL', key]);
    } catch {
      // Fallback
    }
    await this.inMemoryFallback.delete(key);
  }

  public async clear(): Promise<void> {
    try {
      await this.sendCommand(['FLUSHDB']);
    } catch {
      // Fallback
    }
    await this.inMemoryFallback.clear();
  }
}

class CacheService {
  private adapter: CacheAdapter;

  constructor() {
    if (process.env.REDIS_URL) {
      log.info(`Connecting to Redis cache at ${process.env.REDIS_URL}`);
      this.adapter = new RedisCacheAdapter(process.env.REDIS_URL);
    } else {
      this.adapter = new InMemoryCacheAdapter();
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    return this.adapter.get<T>(key);
  }

  public async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
    return this.adapter.set<T>(key, value, ttlSeconds);
  }

  public async delete(key: string): Promise<void> {
    return this.adapter.delete(key);
  }

  public async clear(): Promise<void> {
    return this.adapter.clear();
  }
}

export const cacheService = new CacheService();
