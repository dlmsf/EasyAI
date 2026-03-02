// ========== db.js - The Only File You Need ==========
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========== MACHINE ID GENERATION ==========
/**
 * Gets a machine-specific identifier
 * @returns {string} Machine identifier
 */
function getMachineId() {
    try {
        // Try to get MAC address (most reliable)
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            for (const addr of addrs) {
                if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
                    return addr.mac.replace(/:/g, '');
                }
            }
        }
        
        // Fallback to hostname
        return os.hostname().replace(/[^a-zA-Z0-9]/g, '');
    } catch (error) {
        // Ultimate fallback: random
        return `machine-${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Generates a unique ID using machine ID
 * @returns {string} Unique identifier
 */
function generateUniqueId() {
    const machineId = getMachineId();
    return `${machineId}`;
}

// ========== Default Storage Instance (singleton) ==========
let defaultStorage = null;

export function setDefaultStorage(storage) {
  defaultStorage = storage;
}

export function getDefaultStorage() {
  if (!defaultStorage) {
    defaultStorage = new JSONStorage();
  }
  return defaultStorage;
}

// ========== 1. Storage Connection Interface ==========
export class StorageConnection {
  constructor(options = {}) {
    this.name = options.name || 'app';
    this.autoSave = options.autoSave ?? true;
  }

  async save(key, data) { throw new Error('save() must be implemented'); }
  async load(key) { throw new Error('load() must be implemented'); }
  async delete(key) { throw new Error('delete() must be implemented'); }
  async list() { throw new Error('list() must be implemented'); }
}

// ========== 2. JSON Storage (Default) ==========
export class JSONStorage extends StorageConnection {
  constructor(options = {}) {
    super(options);
    this.folder = options.folder || path.join(process.cwd(), 'data');
    this.extension = options.extension || '.json';
    
    fsSync.mkdirSync(this.folder, { recursive: true });
  }

  _getFilePath(key) {
    return path.join(this.folder, `${key}${this.extension}`);
  }

  _serialize(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    
    if (obj instanceof Map) {
      return { __type: 'Map', data: Array.from(obj.entries()) };
    }
    if (obj instanceof Set) {
      return { __type: 'Set', data: Array.from(obj) };
    }
    if (obj instanceof Date) {
      return { __type: 'Date', data: obj.toISOString() };
    }
    if (obj instanceof RegExp) {
      return { __type: 'RegExp', data: obj.toString() };
    }
    if (Array.isArray(obj)) {
      return obj.map(v => this._serialize(v));
    }
    
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this._serialize(value);
    }
    return result;
  }

  _deserialize(obj) {
    if (obj && typeof obj === 'object') {
      if (obj.__type === 'Map') {
        return new Map(obj.data);
      }
      if (obj.__type === 'Set') {
        return new Set(obj.data);
      }
      if (obj.__type === 'Date') {
        return new Date(obj.data);
      }
      if (obj.__type === 'RegExp') {
        const match = obj.data.match(/\/(.*)\/([gimy]*)$/);
        return match ? new RegExp(match[1], match[2]) : new RegExp(obj.data);
      }
      if (Array.isArray(obj)) {
        return obj.map(v => this._deserialize(v));
      }
      
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this._deserialize(value);
      }
      return result;
    }
    return obj;
  }

  async save(key, data) {
    const filePath = this._getFilePath(key);
    const serialized = this._serialize(data);
    await fs.writeFile(filePath, JSON.stringify(serialized, null, 2));
  }

  async load(key) {
    try {
      const filePath = this._getFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return this._deserialize(data);
    } catch (err) {
      return null;
    }
  }

  async delete(key) {
    try {
      const filePath = this._getFilePath(key);
      await fs.unlink(filePath);
    } catch (err) {}
  }

  async list() {
    try {
      const files = await fs.readdir(this.folder);
      return files
        .filter(f => f.endsWith(this.extension))
        .map(f => f.replace(this.extension, ''));
    } catch (err) {
      return [];
    }
  }
}

// ========== 3. Auto-Loading Cache ==========
const instanceCache = new Map();

// ========== 4. Helper to get full inheritance chain ==========
function getInheritanceChain(obj) {
  const chain = [];
  let proto = obj.constructor;
  
  while (proto && proto.name && proto !== DB && proto !== Object) {
    chain.unshift(proto.name);
    proto = Object.getPrototypeOf(proto);
  }
  
  return chain;
}

// ========== 5. The DB Class - With Options Object ==========
class DB {
  /**
   * @param {Object} options - Configuration options
   * @param {string} [options.id] - Optional unique identifier. If not provided, uses machineID
   * @param {StorageConnection} [options.storage] - Storage implementation
   */
  constructor(options = {}) {
    // Generate ID if not provided (using machine ID)
    const finalUniqueKey = options.id || generateUniqueId();
    
    // Use provided storage or get default
    this._storage = options.storage || getDefaultStorage();
    this._autoSave = this._storage.autoSave;
    this._uniqueKey = finalUniqueKey;
    
    // Build the full key with inheritance chain
    this._key = this._buildKey();
    
    // Check cache first
    const cacheKey = this._key;
    if (instanceCache.has(cacheKey)) {
      return instanceCache.get(cacheKey);
    }
    
    // SYNC LOAD - Load existing data synchronously
    try {
      const filePath = this._storage._getFilePath(this._key);
      if (fsSync.existsSync(filePath)) {
        const content = fsSync.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        const deserialized = this._storage._deserialize(data);
        
        // Apply loaded data to this instance
        for (const [key, value] of Object.entries(deserialized)) {
          if (!key.startsWith('_')) {
            this[key] = value;
          }
        }
      }
    } catch (err) {
      // File doesn't exist or error loading - start fresh
    }
    
    instanceCache.set(cacheKey, this);
    
    // No Proxy needed - just return this
    return this;
  }

  // Build key that includes the entire inheritance chain
  _buildKey() {
    const chain = getInheritanceChain(this);
    return `${chain.join('.')}:${this._uniqueKey}`;
  }

  // Save method (async but can be called manually)
  async save() {
    const state = {};
    let current = this;
    
    while (current && current !== Object.prototype) {
      Object.getOwnPropertyNames(current).forEach(prop => {
        if (prop.startsWith('_') || prop === 'constructor') return;
        
        const descriptor = Object.getOwnPropertyDescriptor(current, prop);
        if (descriptor && !descriptor.get) {
          state[prop] = current[prop];
        }
      });
      current = Object.getPrototypeOf(current);
    }
    
    await this._storage.save(this._key, state);
    return this;
  }

  // Auto-save method (call this when you want to save)
  async autoSave() {
    if (this._autoSave) {
      await this.save();
    }
  }

  // Get the unique key for this instance
  get uniqueKey() {
    return this._uniqueKey;
  }

  // Get the full inheritance chain
  get inheritanceChain() {
    return getInheritanceChain(this);
  }

  // Get the full storage key
  get storageKey() {
    return this._key;
  }

  // Manual delete if needed
  async delete() {
    await this._storage.delete(this._key);
    instanceCache.delete(this._key);
    return this;
  }

  // Static method to get all instances of a class (exact match)
  static async getAll(storage = null) {
    const store = storage || getDefaultStorage();
    const keys = await store.list();
    const instances = [];
    const className = this.name;
    
    for (const key of keys) {
      const [classChain] = key.split(':');
      const classes = classChain.split('.');
      const lastClass = classes[classes.length - 1];
      
      if (lastClass === className) {
        const uniqueKey = key.split(':')[1];
        const instance = new this({ id: uniqueKey, storage: store });
        instances.push(instance);
      }
    }
    
    return instances;
  }
  
  // Get all instances that match or inherit from this class
  static async getAllIncludingSubclasses(storage = null) {
    const store = storage || getDefaultStorage();
    const keys = await store.list();
    const instances = [];
    const className = this.name;
    
    for (const key of keys) {
      const [classChain] = key.split(':');
      const classes = classChain.split('.');
      
      if (classes.includes(className)) {
        const uniqueKey = key.split(':')[1];
        const instance = new this({ id: uniqueKey, storage: store });
        instances.push(instance);
      }
    }
    
    return instances;
  }
  
  // Find by unique key (respects full inheritance)
  static async findBy(uniqueKey, storage = null) {
    const store = storage || getDefaultStorage();
    const keys = await store.list();
    const matchingKey = keys.find(k => k.endsWith(`:${uniqueKey}`));
    
    if (matchingKey) {
      const instance = new this({ id: uniqueKey, storage: store });
      return instance;
    }
    return null;
  }

  // Static method to get machine ID (useful for debugging)
  static getMachineId() {
    return getMachineId();
  }

  // Static method to generate unique ID
  static generateUniqueId() {
    return generateUniqueId();
  }
}

export default DB