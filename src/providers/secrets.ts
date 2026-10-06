/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface ProviderCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
}

const SECRETS_STORAGE_KEY = 'aeroradar.secrets.v1';

class SecretsManagerImpl {
  private inMemorySecrets: Record<string, ProviderCredentials> = {};
  private encryptionPassword = '';
  private isProtected = false;

  constructor() {
    this.loadOnStart();
  }

  // Check if secrets are encrypted with password
  public isPasswordProtected(): boolean {
    return this.isProtected;
  }

  public setPassword(password: string) {
    this.encryptionPassword = password;
  }

  public getPassword(): string {
    return this.encryptionPassword;
  }

  private loadOnStart() {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(SECRETS_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (parsed && parsed.encrypted === true) {
        this.isProtected = true;
        // Memory empty until decrypted
        this.inMemorySecrets = {};
      } else if (parsed && parsed.secrets) {
        this.isProtected = false;
        this.inMemorySecrets = parsed.secrets;
      }
    } catch {
      // fail-safe
    }
  }

  public getCredentials(providerId: string): ProviderCredentials {
    return this.inMemorySecrets[providerId] || {};
  }

  public setCredentials(providerId: string, creds: ProviderCredentials) {
    this.inMemorySecrets[providerId] = creds;
    this.save();
  }

  public clearAll() {
    this.inMemorySecrets = {};
    this.encryptionPassword = '';
    this.isProtected = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SECRETS_STORAGE_KEY);
    }
  }

  // Enable/Disable password protection
  public async setPasswordProtection(enabled: boolean, password = ''): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    if (!enabled) {
      this.isProtected = false;
      this.encryptionPassword = '';
      this.save();
      return true;
    }

    if (!password) return false;
    this.encryptionPassword = password;
    this.isProtected = true;
    return await this.saveEncrypted();
  }

  private save() {
    if (typeof window === 'undefined') return;

    if (this.isProtected && this.encryptionPassword) {
      this.saveEncrypted().catch(() => {});
      return;
    }

    try {
      const payload = {
        encrypted: false,
        secrets: this.inMemorySecrets
      };
      localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('[SecretsManager] Failed to save secrets plain:', e);
    }
  }

  private async saveEncrypted(): Promise<boolean> {
    try {
      const dataStr = JSON.stringify(this.inMemorySecrets);
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(dataStr);

      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Derive key
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(this.encryptionPassword),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        dataBytes
      );

      const payload = {
        encrypted: true,
        salt: this.bufToBase64(salt),
        iv: this.bufToBase64(iv),
        ciphertext: this.bufToBase64(new Uint8Array(ciphertext))
      };

      localStorage.setItem(SECRETS_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('[SecretsManager] Encryption failed:', err);
      return false;
    }
  }

  public async unlockWithPassword(password: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      const raw = localStorage.getItem(SECRETS_STORAGE_KEY);
      if (!raw) return false;

      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.encrypted) return false;

      const salt = this.base64ToBuf(parsed.salt);
      const iv = this.base64ToBuf(parsed.iv);
      const ciphertext = this.base64ToBuf(parsed.ciphertext);

      const encoder = new TextEncoder();
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      const key = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt as any,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        ciphertext as any
      );

      const decoder = new TextDecoder();
      const decryptedStr = decoder.decode(decrypted);

      this.inMemorySecrets = JSON.parse(decryptedStr);
      this.encryptionPassword = password;
      this.isProtected = true;
      return true;
    } catch (err) {
      console.warn('[SecretsManager] Incorrect password or decryption failed:', err);
      return false;
    }
  }

  // Export secrets (optional payload inclusion)
  public exportSecretsPayload(): any {
    return this.inMemorySecrets;
  }

  public importSecretsPayload(data: any) {
    if (data && typeof data === 'object') {
      this.inMemorySecrets = { ...this.inMemorySecrets, ...data };
      this.save();
    }
  }

  // --- Helper conversions ---
  private bufToBase64(buf: Uint8Array): string {
    let binary = '';
    const len = buf.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buf[i]);
    }
    return window.btoa(binary);
  }

  private base64ToBuf(base64: string): Uint8Array {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const SecretsManager = new SecretsManagerImpl();
