/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface CacheItem {
  id: string; // text + voice + model key
  audio: ArrayBuffer;
  expires: number;
}

export class AudioCache {
  private static DB_NAME = 'ircap_audio_cache_db';
  private static STORE_NAME = 'audio_cache';
  private static DB_VERSION = 1;
  private static memoryCache = new Map<string, ArrayBuffer>();

  private static getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported'));
        return;
      }

      const request = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get a key string
  public static makeKey(text: string, voice: string, model: string): string {
    return `${text.trim()}_${voice}_${model}`;
  }

  // Retrieve an item from Memory or IndexedDB
  public static async get(text: string, voice: string, model: string): Promise<ArrayBuffer | null> {
    const key = this.makeKey(text, voice, model);

    // 1. Check Memory Cache
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) || null;
    }

    // 2. Check IndexedDB
    try {
      const db = await this.getDB();
      return new Promise<ArrayBuffer | null>((resolve) => {
        const transaction = db.transaction(this.STORE_NAME, 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          const result = request.result as CacheItem | undefined;
          if (result) {
            // Check expiry (7 days)
            if (Date.now() < result.expires) {
              // Save back to memory and resolve
              this.memoryCache.set(key, result.audio);
              resolve(result.audio);
            } else {
              // Delete expired item
              this.deleteKey(key).catch(() => {});
              resolve(null);
            }
          } else {
            resolve(null);
          }
        };

        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  // Save an item to Memory and IndexedDB
  public static async set(text: string, voice: string, model: string, audio: ArrayBuffer): Promise<void> {
    const key = this.makeKey(text, voice, model);

    // 1. Save to Memory
    this.memoryCache.set(key, audio);

    // 2. Save to IndexedDB
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);

        const expires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days expiry
        const item: CacheItem = { id: key, audio, expires };

        const request = store.put(item);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Ignore failures saving to IndexedDB, memory cache is still active
    }
  }

  private static async deleteKey(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // ignore
    }
  }

  // Clear all cache
  public static async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(this.STORE_NAME, 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // ignore
    }
  }
}
