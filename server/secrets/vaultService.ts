import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from '../utils/log.js';
import { VAULT_KEY_BY_PROVIDER, type DirectProvider } from '../../src/core/shared/aiProviders.js';

export interface DecryptedVault {
  anthropicApiKey?: string;
  openAiApiKey?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  xaiApiKey?: string;
  mistralApiKey?: string;
  groqApiKey?: string;
  cohereApiKey?: string;
  metaApiKey?: string;
  perplexityApiKey?: string;
  customBaseUrl?: string;
  dbUrlOverride?: string;
  [key: string]: string | undefined;
}

interface EncryptedVaultPayload {
  version: number;
  iv: string;
  authTag: string;
  salt: string;
  ciphertext: string;
}

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = 'sha256';

export function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

export function encryptPayload(data: DecryptedVault, passphrase: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const jsonStr = JSON.stringify(data);
  const ciphertext = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload: EncryptedVaultPayload = {
    version: 1,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
    ciphertext: ciphertext.toString('hex'),
  };

  return JSON.stringify(payload, null, 2);
}

export function decryptPayload(encryptedJson: string, passphrase: string): DecryptedVault {
  let payload: EncryptedVaultPayload;
  try {
    payload = JSON.parse(encryptedJson);
  } catch {
    throw new Error('Invalid vault file format: malformed JSON');
  }

  if (payload.version !== 1 || !payload.iv || !payload.authTag || !payload.salt || !payload.ciphertext) {
    throw new Error('Invalid vault payload: missing required cryptographic fields');
  }

  const salt = Buffer.from(payload.salt, 'hex');
  const iv = Buffer.from(payload.iv, 'hex');
  const authTag = Buffer.from(payload.authTag, 'hex');
  const ciphertext = Buffer.from(payload.ciphertext, 'hex');

  const key = deriveKey(passphrase, salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    throw new Error('Failed to decrypt vault: incorrect passphrase or corrupted data');
  }
}

const SECRETS_DIR = path.resolve(process.cwd(), '.secrets');
const VAULT_FILE = path.join(SECRETS_DIR, 'vault.enc');
const MACHINE_SALT_FILE = path.join(SECRETS_DIR, 'salt.bin');

export class VaultService {
  private inMemoryVault: DecryptedVault | null = null;
  private isLoaded: boolean = false;

  private getEffectivePassphrase(customPassphrase?: string): string {
    if (customPassphrase && customPassphrase.trim()) {
      return customPassphrase.trim();
    }
    if (process.env.STUDYTS_MASTER_KEY && process.env.STUDYTS_MASTER_KEY.trim()) {
      return process.env.STUDYTS_MASTER_KEY.trim();
    }

    // Use machine-local secret salt as fallback passphrase
    if (!fs.existsSync(SECRETS_DIR)) {
      fs.mkdirSync(SECRETS_DIR, { recursive: true });
    }

    if (!fs.existsSync(MACHINE_SALT_FILE)) {
      const machineSalt = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(MACHINE_SALT_FILE, machineSalt, { encoding: 'utf8', mode: 0o600 });
      return machineSalt;
    }

    return fs.readFileSync(MACHINE_SALT_FILE, 'utf8').trim();
  }

  public initialize(passphrase?: string): boolean {
    if (!fs.existsSync(VAULT_FILE)) {
      this.inMemoryVault = {};
      this.isLoaded = true;
      return false;
    }

    try {
      const encryptedJson = fs.readFileSync(VAULT_FILE, 'utf8');
      const pass = this.getEffectivePassphrase(passphrase);
      this.inMemoryVault = decryptPayload(encryptedJson, pass);
      this.isLoaded = true;
      log.info('Encrypted secrets vault loaded into memory', {
        keysCount: Object.keys(this.inMemoryVault).length,
      });
      return true;
    } catch (err) {
      this.inMemoryVault = {};
      this.isLoaded = true;
      log.warn('Could not decrypt secrets vault on startup', {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  public getKey(providerOrKey: string): string | undefined {
    if (!this.isLoaded) {
      this.initialize();
    }

    if (!this.inMemoryVault) return undefined;

    const normalized = String(providerOrKey).toLowerCase();
    const targetKey = VAULT_KEY_BY_PROVIDER[normalized as DirectProvider] || (String(providerOrKey) as keyof DecryptedVault);
    return this.inMemoryVault[targetKey];
  }

  public setKey(keyName: keyof DecryptedVault | string, value: string, passphrase?: string): void {
    if (!this.isLoaded) {
      this.initialize(passphrase);
    }

    this.inMemoryVault = this.inMemoryVault || {};
    const normalized = String(keyName).toLowerCase();
    const targetKey = VAULT_KEY_BY_PROVIDER[normalized as DirectProvider] || (String(keyName) as keyof DecryptedVault);
    this.inMemoryVault[targetKey] = value;

    if (!fs.existsSync(SECRETS_DIR)) {
      fs.mkdirSync(SECRETS_DIR, { recursive: true });
    }

    const pass = this.getEffectivePassphrase(passphrase);
    const encryptedJson = encryptPayload(this.inMemoryVault, pass);
    fs.writeFileSync(VAULT_FILE, encryptedJson, { encoding: 'utf8', mode: 0o600 });
  }

  public removeKey(providerOrKey: string, passphrase?: string): void {
    if (!this.isLoaded) {
      this.initialize(passphrase);
    }

    if (!this.inMemoryVault) return;

    const normalized = String(providerOrKey).toLowerCase();
    const targetKey = VAULT_KEY_BY_PROVIDER[normalized as DirectProvider] || (String(providerOrKey) as keyof DecryptedVault);
    delete this.inMemoryVault[targetKey];

    if (!fs.existsSync(SECRETS_DIR)) {
      fs.mkdirSync(SECRETS_DIR, { recursive: true });
    }

    const pass = this.getEffectivePassphrase(passphrase);
    const encryptedJson = encryptPayload(this.inMemoryVault, pass);
    fs.writeFileSync(VAULT_FILE, encryptedJson, { encoding: 'utf8', mode: 0o600 });
  }

  public listMaskedKeys(): Record<string, string> {
    if (!this.isLoaded) {
      this.initialize();
    }

    const result: Record<string, string> = {};
    if (!this.inMemoryVault) return result;

    for (const [k, v] of Object.entries(this.inMemoryVault)) {
      if (typeof v === 'string' && v.length > 0) {
        if (v.length <= 8) {
          result[k] = '***';
        } else {
          result[k] = `${v.slice(0, 6)}...${v.slice(-3)}`;
        }
      }
    }
    return result;
  }

  public isVaultConfigured(): boolean {
    return fs.existsSync(VAULT_FILE);
  }

  public purge(): void {
    this.inMemoryVault = {};
    this.isLoaded = false;
    if (fs.existsSync(SECRETS_DIR)) {
      fs.rmSync(SECRETS_DIR, { recursive: true, force: true });
      log.info('Secrets vault purged from disk');
    }
  }
}

export const vaultService = new VaultService();
