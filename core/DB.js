// ========== db.js - Production Ready Version ==========
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import EventEmitter from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========== MACHINE ID GENERATION ==========
// Cache the machine ID so it's always the same
let MACHINE_ID_CACHE = null;

/**
 * Gets a machine-specific identifier (always the same for this machine)
 * @returns {string} Machine identifier
 */
function getMachineId() {
    if (MACHINE_ID_CACHE) {
        return MACHINE_ID_CACHE;
    }
    
    try {
        // Try to get MAC address (most reliable)
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            for (const addr of addrs) {
                if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
                    MACHINE_ID_CACHE = addr.mac.replace(/:/g, '');
                    return MACHINE_ID_CACHE;
                }
            }
        }
        
        // Fallback to hostname
        MACHINE_ID_CACHE = os.hostname().replace(/[^a-zA-Z0-9]/g, '');
        return MACHINE_ID_CACHE;
    } catch (error) {
        // Ultimate fallback: random (but still cache it)
        MACHINE_ID_CACHE = `machine-${Math.random().toString(36).substr(2, 9)}`;
        return MACHINE_ID_CACHE;
    }
}

// ========== Default Storage Instance ==========
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

// ========== Lock Manager for ACID Compliance ==========
class LockManager {
    constructor() {
        this.locks = new Map();
        this.waitingQueues = new Map();
        this.acquireTimeouts = new Map();
    }

    async acquireLock(key, timeout = 5000) {
        const startTime = Date.now();
        
        while (this.locks.get(key)) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`Lock acquisition timeout for key: ${key}`);
            }
            
            if (!this.waitingQueues.has(key)) {
                this.waitingQueues.set(key, []);
            }
            
            await new Promise(resolve => {
                this.waitingQueues.get(key).push(resolve);
            });
        }
        
        this.locks.set(key, true);
        
        const timeoutId = setTimeout(() => {
            this.releaseLock(key);
        }, timeout);
        
        this.acquireTimeouts.set(key, timeoutId);
        
        return true;
    }

    releaseLock(key) {
        this.locks.delete(key);
        
        if (this.acquireTimeouts.has(key)) {
            clearTimeout(this.acquireTimeouts.get(key));
            this.acquireTimeouts.delete(key);
        }
        
        const queue = this.waitingQueues.get(key);
        if (queue && queue.length > 0) {
            const nextResolve = queue.shift();
            nextResolve();
        }
        
        if (queue && queue.length === 0) {
            this.waitingQueues.delete(key);
        }
    }
}

// ========== Cache Manager with Intelligent Memory Management ==========
class CacheManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.cache = new Map();
        this.accessTimes = new Map();
        this.dirtyFlags = new Map();
        this.maxSize = options.maxCacheSize || 1000;
        this.ttl = options.cacheTTL || 30 * 60 * 1000;
        this.cleanupInterval = options.cleanupInterval || 60 * 1000;
        
        this.memoryThreshold = options.memoryThreshold || 0.8;
        this.lastCleanup = Date.now();
        this.cleanupTimer = null;
        this.instanceMetrics = new Map();
        
        this.isRunning = false;
    }

    _ensureCleanupRunning() {
        if (!this.isRunning && this.cache.size > 0) {
            this.startCleanup();
        }
    }

    set(key, instance, isDirty = false) {
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }
        
        if (this.isMemoryPressure()) {
            this.evictUnderutilized(0.3);
        }
        
        this.cache.set(key, instance);
        this.updateAccess(key);
        
        if (isDirty) {
            this.dirtyFlags.set(key, true);
        }
        
        this._ensureCleanupRunning();
        this.emit('instance:cached', { key, instance });
    }

    get(key) {
        if (this.cache.has(key)) {
            this.updateAccess(key);
            this._ensureCleanupRunning();
            return this.cache.get(key);
        }
        return null;
    }

    has(key) {
        return this.cache.has(key);
    }

    delete(key) {
        this.cache.delete(key);
        this.accessTimes.delete(key);
        this.dirtyFlags.delete(key);
        this.instanceMetrics.delete(key);
        this.emit('instance:evicted', { key });
    }

    isDirty(key) {
        return this.dirtyFlags.has(key);
    }

    markClean(key) {
        this.dirtyFlags.delete(key);
    }

    updateAccess(key) {
        this.accessTimes.set(key, Date.now());
        
        const metrics = this.instanceMetrics.get(key) || { accessCount: 0, lastAccess: 0 };
        metrics.accessCount++;
        metrics.lastAccess = Date.now();
        this.instanceMetrics.set(key, metrics);
    }

    evictLRU() {
        let oldest = null;
        let oldestTime = Infinity;
        
        for (const [key, time] of this.accessTimes.entries()) {
            if (time < oldestTime && !this.dirtyFlags.has(key)) {
                oldestTime = time;
                oldest = key;
            }
        }
        
        if (oldest) {
            this.delete(oldest);
            this.emit('eviction:lru', { key: oldest });
        }
    }

    evictUnderutilized(percentage) {
        const instances = Array.from(this.cache.keys())
            .filter(key => !this.dirtyFlags.has(key))
            .map(key => ({
                key,
                accessCount: this.instanceMetrics.get(key)?.accessCount || 0,
                lastAccess: this.accessTimes.get(key) || 0
            }))
            .sort((a, b) => a.accessCount - b.accessCount || a.lastAccess - b.lastAccess);
        
        const evictCount = Math.floor(instances.length * percentage);
        
        for (let i = 0; i < evictCount; i++) {
            this.delete(instances[i].key);
        }
        
        this.emit('eviction:underutilized', { count: evictCount });
    }

    isMemoryPressure() {
        const memoryUsage = process.memoryUsage();
        const heapUsed = memoryUsage.heapUsed;
        const heapTotal = memoryUsage.heapTotal;
        
        return (heapUsed / heapTotal) > this.memoryThreshold;
    }

    startCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.isRunning = true;
        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            
            for (const [key, accessTime] of this.accessTimes.entries()) {
                if (now - accessTime > this.ttl && !this.dirtyFlags.has(key)) {
                    this.delete(key);
                }
            }
            
            if (this.isMemoryPressure()) {
                this.evictUnderutilized(0.2);
            }
            
            if (this.cache.size === 0) {
                this.stopCleanup();
            }
            
            this.emit('cleanup:completed', {
                cacheSize: this.cache.size,
                dirtyCount: this.dirtyFlags.size
            });
        }, this.cleanupInterval);
        
        this.cleanupTimer.unref();
    }

    stopCleanup() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            this.isRunning = false;
        }
    }

    async flushAll() {
        for (const [key] of this.dirtyFlags) {
            const instance = this.cache.get(key);
            if (instance && instance.save) {
                await instance.save();
            }
        }
        this.dirtyFlags.clear();
    }

    async shutdown() {
        await this.flushAll();
        this.stopCleanup();
        this.cache.clear();
        this.accessTimes.clear();
        this.instanceMetrics.clear();
    }
}

// ========== Storage Connection Interface ==========
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

// ========== JSON Storage with ACID Support ==========
export class JSONStorage extends StorageConnection {
    constructor(options = {}) {
        super(options);
        this.folder = options.folder || path.join(process.cwd(), 'data');
        this.extension = options.extension || '.json';
        this.lockManager = new LockManager();
        
        this.txnLogFolder = path.join(this.folder, 'txn_logs');
        fsSync.mkdirSync(this.folder, { recursive: true });
        fsSync.mkdirSync(this.txnLogFolder, { recursive: true });
    }

    _getFilePath(key) {
        return path.join(this.folder, `${key}${this.extension}`);
    }

    _getTxnLogPath(key, txnId) {
        return path.join(this.txnLogFolder, `${key}_${txnId}.log`);
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
        const txnId = crypto.randomBytes(16).toString('hex');
        
        await this.lockManager.acquireLock(key);
        
        try {
            const txnLogPath = this._getTxnLogPath(key, txnId);
            const serialized = this._serialize(data);
            await fs.writeFile(txnLogPath, JSON.stringify(serialized));
            
            const filePath = this._getFilePath(key);
            await fs.writeFile(filePath, JSON.stringify(serialized, null, 2));
            
            await fs.unlink(txnLogPath).catch(() => {});
            
        } catch (error) {
            await this._recover(key);
            throw error;
        } finally {
            this.lockManager.releaseLock(key);
        }
    }

    async load(key) {
        await this.lockManager.acquireLock(key, 1000);
        
        try {
            const filePath = this._getFilePath(key);
            
            try {
                await fs.access(filePath);
            } catch {
                return null;
            }
            
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            return this._deserialize(data);
            
        } catch (err) {
            const recovered = await this._recover(key);
            if (recovered) {
                return recovered;
            }
            return null;
        } finally {
            this.lockManager.releaseLock(key);
        }
    }

    async _recover(key) {
        try {
            const files = await fs.readdir(this.txnLogFolder);
            const txnLogs = files.filter(f => f.startsWith(`${key}_`));
            
            if (txnLogs.length > 0) {
                txnLogs.sort();
                const latestTxn = txnLogs[txnLogs.length - 1];
                const txnPath = path.join(this.txnLogFolder, latestTxn);
                
                const content = await fs.readFile(txnPath, 'utf-8');
                const data = JSON.parse(content);
                
                const filePath = this._getFilePath(key);
                await fs.writeFile(filePath, JSON.stringify(data, null, 2));
                
                for (const log of txnLogs) {
                    await fs.unlink(path.join(this.txnLogFolder, log)).catch(() => {});
                }
                
                return this._deserialize(data);
            }
        } catch (error) {
            console.error('Recovery failed:', error);
        }
        
        return null;
    }

    async delete(key) {
        await this.lockManager.acquireLock(key);
        
        try {
            const filePath = this._getFilePath(key);
            await fs.unlink(filePath).catch(() => {});
        } finally {
            this.lockManager.releaseLock(key);
        }
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

// ========== Helper Functions ==========
function getInheritanceChain(obj) {
    const chain = [];
    let proto = obj.constructor;
    
    while (proto && proto.name && proto !== DB && proto !== Object) {
        chain.unshift(proto.name);
        proto = Object.getPrototypeOf(proto);
    }
    
    return chain;
}

// ========== Global Cache Manager ==========
const globalCache = new CacheManager({
    maxCacheSize: 1000,
    cacheTTL: 30 * 60 * 1000,
    cleanupInterval: 60 * 1000,
    memoryThreshold: 0.8
});

// Handle process exit to flush cache
process.on('beforeExit', async () => {
    await globalCache.flushAll();
    await globalCache.shutdown();
});

process.on('SIGINT', async () => {
    await globalCache.flushAll();
    await globalCache.shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await globalCache.flushAll();
    await globalCache.shutdown();
    process.exit(0);
});

// ========== The Enhanced DB Class ==========
class DB {
    /**
     * @param {Object|string} options - Configuration options or unique ID string
     */
    constructor(options = {}) {
        // Capture the first argument passed to the constructor
        const firstArg = arguments.length > 0 ? arguments[0] : null;
        
        // Determine the unique key
        let finalUniqueKey;
        let storage = null;
        let autoSave = true;
        
        if (typeof firstArg === 'string') {
            // If first arg is a string, use it as the ID
            finalUniqueKey = firstArg;
            // Check if options is the second argument
            if (arguments.length > 1 && arguments[1] && typeof arguments[1] === 'object') {
                storage = arguments[1].storage;
                autoSave = arguments[1].autoSave !== false;
            }
        } else if (firstArg && typeof firstArg === 'object') {
            // If first arg is an object, extract id from it
            finalUniqueKey = firstArg.id || getMachineId(); // Use machine ID if no id provided
            storage = firstArg.storage;
            autoSave = firstArg.autoSave !== false;
        } else {
            // No arguments provided - use machine ID
            finalUniqueKey = getMachineId();
        }
        
        // Use provided storage or get default
        this._storage = storage || getDefaultStorage();
        this._autoSave = autoSave;
        this._uniqueKey = finalUniqueKey;
        
        // Build the full key with inheritance chain
        this._key = this._buildKey();
        
        // Check cache first
        if (globalCache.has(this._key)) {
            return globalCache.get(this._key);
        }
        
        // Load data from storage
        this._loadSync();
        
        // Store in cache
        globalCache.set(this._key, this, false);
        
        return this;
    }

    _buildKey() {
        const chain = getInheritanceChain(this);
        return `${chain.join('.')}:${this._uniqueKey}`;
    }

    _loadSync() {
        try {
            const filePath = this._storage._getFilePath(this._key);
            if (fsSync.existsSync(filePath)) {
                const content = fsSync.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                const deserialized = this._storage._deserialize(data);
                
                for (const [key, value] of Object.entries(deserialized)) {
                    if (!key.startsWith('_')) {
                        this[key] = value;
                    }
                }
            }
        } catch (err) {
            // File doesn't exist or error loading - start fresh
        }
    }

    async _loadAsync() {
        const data = await this._storage.load(this._key);
        if (data) {
            for (const [key, value] of Object.entries(data)) {
                if (!key.startsWith('_')) {
                    this[key] = value;
                }
            }
        }
    }

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
        globalCache.markClean(this._key);
        
        return this;
    }

    _markDirty() {
        if (globalCache.has(this._key)) {
            globalCache.updateAccess(this._key);
        }
    }

    async autoSave() {
        if (this._autoSave) {
            await this.save();
        }
    }

    async reload() {
        await this._loadAsync();
        return this;
    }

    get uniqueKey() {
        return this._uniqueKey;
    }

    get inheritanceChain() {
        return getInheritanceChain(this);
    }

    get storageKey() {
        return this._key;
    }

    async delete() {
        await this._storage.delete(this._key);
        globalCache.delete(this._key);
        return this;
    }

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
                const instance = new this(uniqueKey, { storage: store });
                instances.push(instance);
            }
        }
        
        return instances;
    }
    
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
                const instance = new this(uniqueKey, { storage: store });
                instances.push(instance);
            }
        }
        
        return instances;
    }
    
    static async findBy(uniqueKey, storage = null) {
        const store = storage || getDefaultStorage();
        const keys = await store.list();
        const matchingKey = keys.find(k => k.endsWith(`:${uniqueKey}`));
        
        if (matchingKey) {
            return new this(uniqueKey, { storage: store });
        }
        return null;
    }

    static getMachineId() {
        return getMachineId();
    }

    static getCacheStats() {
        return {
            size: globalCache.cache.size,
            dirtyCount: globalCache.dirtyFlags.size,
            memoryUsage: process.memoryUsage()
        };
    }

    static async flushCache() {
        await globalCache.flushAll();
    }

    static clearCache() {
        globalCache.shutdown();
    }
}

export default DB;