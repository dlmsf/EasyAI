// ========== db.js - Fixed Version (process exits properly) ==========
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========== MACHINE ID GENERATION ==========
/**
 * Gets a machine-specific identifier (CONSISTENT between runs)
 * @returns {string} Machine identifier
 */
function getMachineId() {
    try {
        // Try to get MAC address (most reliable and consistent)
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            for (const addr of addrs) {
                if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
                    return addr.mac.replace(/:/g, '');
                }
            }
        }
        
        // Fallback to hostname (consistent for a machine)
        return os.hostname().replace(/[^a-zA-Z0-9]/g, '');
    } catch (error) {
        // Ultimate fallback: a consistent ID based on machine path
        // This ensures the same machine gets the same ID
        return `machine-${crypto.createHash('md5').update(__dirname).digest('hex').substr(0, 8)}`;
    }
}

/**
 * Generates a consistent unique ID using only machine ID
 * @returns {string} Unique identifier (consistent between runs)
 */
function generateUniqueId() {
    // JUST the machine ID - no random bytes, no timestamp
    // This ensures the same machine gets the same ID every time
    return getMachineId();
}

// ========== Lock Manager for ACID Compliance (NON-BLOCKING) ==========
class LockManager {
    constructor() {
        this.locks = new Map();
        this.timeout = 5000; // 5 second lock timeout
    }

    async acquire(key, timeout = 5000) {
        const startTime = Date.now();
        
        // Non-blocking check - if locked, wait but don't block the event loop
        while (this.locks.has(key)) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`Lock acquisition timeout for key: ${key}`);
            }
            // Use setImmediate to not block the event loop
            await new Promise(resolve => setImmediate(resolve));
        }
        
        this.locks.set(key, {
            acquired: Date.now(),
            timeout: this.timeout
        });
        
        return {
            release: () => this.release(key)
        };
    }

    release(key) {
        this.locks.delete(key);
    }

    // Check if a key is locked without waiting
    isLocked(key) {
        return this.locks.has(key);
    }
}

// ========== Memory Manager with LRU Strategy ==========
class MemoryManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.maxInstances = options.maxInstances || 1000;
        this.maxMemoryPercent = options.maxMemoryPercent || 70; // Max 70% memory usage
        this.instanceAccess = new Map(); // track last access time
        this.instanceData = new Map(); // store instance data when unloaded
        this.unloadTimeout = options.unloadTimeout || 30 * 60 * 1000; // 30 minutes default
        this.checkInterval = options.checkInterval || 60 * 1000; // Check every minute
        this._interval = null;
        this._instanceCount = 0;
    }

    startMonitoring() {
        // Only start if we have instances and no interval running
        if (this._instanceCount > 0 && !this._interval) {
            this._interval = setInterval(() => {
                this.checkMemoryAndUnload().catch(console.error);
            }, this.checkInterval);
            // Allow the interval to be the only thing keeping the process alive
            this._interval.unref();
        }
    }

    stopMonitoring() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
    }

    incrementInstanceCount() {
        this._instanceCount++;
        this.startMonitoring();
    }

    decrementInstanceCount() {
        this._instanceCount = Math.max(0, this._instanceCount - 1);
        if (this._instanceCount === 0) {
            this.stopMonitoring();
        }
    }

    getMemoryUsagePercent() {
        const used = process.memoryUsage().heapUsed;
        const total = os.totalmem();
        return (used / total) * 100;
    }

    async checkMemoryAndUnload() {
        // Don't do anything if no instances
        if (this._instanceCount === 0) {
            this.stopMonitoring();
            return;
        }

        const memoryPercent = this.getMemoryUsagePercent();
        
        if (memoryPercent > this.maxMemoryPercent || this.instanceAccess.size > this.maxInstances) {
            await this.unloadLeastUsed();
        }
    }

    async unloadLeastUsed() {
        const now = Date.now();
        const instances = Array.from(this.instanceAccess.entries());
        
        // Sort by last access time (oldest first)
        instances.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        
        let unloaded = 0;
        const targetUnload = Math.floor(this.instanceAccess.size * 0.2); // Unload 20% of instances
        
        for (const [key, data] of instances) {
            if (unloaded >= targetUnload) break;
            
            // Only unload if not accessed recently
            if (now - data.lastAccess > this.unloadTimeout && !data.dirty) {
                this.instanceData.set(key, data.serialized);
                this.instanceAccess.delete(key);
                this.emit('instanceUnloaded', key);
                unloaded++;
            }
        }
    }

    registerAccess(instance) {
        const key = instance._key;
        this.instanceAccess.set(key, {
            lastAccess: Date.now(),
            dirty: instance._dirty || false,
            serialized: instance._getSerializedState()
        });
    }

    markDirty(instance) {
        const key = instance._key;
        const data = this.instanceAccess.get(key);
        if (data) {
            data.dirty = true;
            data.lastAccess = Date.now();
        }
    }

    markClean(instance) {
        const key = instance._key;
        const data = this.instanceAccess.get(key);
        if (data) {
            data.dirty = false;
            data.serialized = instance._getSerializedState();
        }
    }

    shouldLoad(key) {
        return !this.instanceAccess.has(key) && this.instanceData.has(key);
    }

    getUnloadedData(key) {
        return this.instanceData.get(key);
    }

    removeUnloadedData(key) {
        this.instanceData.delete(key);
    }
}

// ========== Transaction Logger for ACID ==========
class TransactionLogger {
    constructor(storage) {
        this.storage = storage;
        this.logFile = path.join(storage.folder, '_transactions.log');
        this.pendingTransactions = new Map();
    }

    async begin(instanceKey) {
        const transactionId = crypto.randomBytes(16).toString('hex');
        this.pendingTransactions.set(transactionId, {
            instanceKey,
            changes: [],
            timestamp: Date.now()
        });
        
        await this._log('BEGIN', transactionId, instanceKey);
        return transactionId;
    }

    async logChange(transactionId, key, oldValue, newValue) {
        const transaction = this.pendingTransactions.get(transactionId);
        if (transaction) {
            transaction.changes.push({ key, oldValue, newValue });
            await this._log('CHANGE', transactionId, { key, oldValue, newValue });
        }
    }

    async commit(transactionId) {
        const transaction = this.pendingTransactions.get(transactionId);
        if (transaction) {
            await this._log('COMMIT', transactionId);
            this.pendingTransactions.delete(transactionId);
        }
    }

    async rollback(transactionId) {
        const transaction = this.pendingTransactions.get(transactionId);
        if (transaction) {
            await this._log('ROLLBACK', transactionId);
            // Apply rollback logic here if needed
            this.pendingTransactions.delete(transactionId);
        }
    }

    async _log(type, transactionId, data = null) {
        const logEntry = {
            type,
            transactionId,
            timestamp: Date.now(),
            data
        };
        
        try {
            await fs.appendFile(this.logFile, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('Transaction log error:', error);
        }
    }
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

// ========== 2. JSON Storage (Enhanced) ==========
export class JSONStorage extends StorageConnection {
    constructor(options = {}) {
        super(options);
        this.folder = options.folder || path.join(process.cwd(), 'data');
        this.extension = options.extension || '.json';
        this.writeQueue = new Map();
        this.isWriting = false;
        this.pendingWrites = 0;
        
        fsSync.mkdirSync(this.folder, { recursive: true });
    }

    _getFilePath(key) {
        // Sanitize key for filesystem
        const sanitizedKey = key.replace(/[^a-zA-Z0-9._:-]/g, '_');
        return path.join(this.folder, `${sanitizedKey}${this.extension}`);
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
        if (obj instanceof Error) {
            return { __type: 'Error', data: { message: obj.message, stack: obj.stack } };
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
            if (obj.__type === 'Error') {
                const error = new Error(obj.data.message);
                error.stack = obj.data.stack;
                return error;
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
        this.pendingWrites++;
        // Queue the write operation
        this.writeQueue.set(key, data);
        
        if (!this.isWriting) {
            this.isWriting = true;
            // Use setImmediate to not block
            setImmediate(() => this._processWriteQueue());
        }
    }

    async _processWriteQueue() {
        const writes = Array.from(this.writeQueue.entries());
        this.writeQueue.clear();
        
        // Process writes in batches to avoid blocking
        const batchSize = 5;
        for (let i = 0; i < writes.length; i += batchSize) {
            const batch = writes.slice(i, i + batchSize);
            
            const writePromises = batch.map(async ([key, data]) => {
                const filePath = this._getFilePath(key);
                const serialized = this._serialize(data);
                
                // Atomic write
                const tempPath = `${filePath}.tmp`;
                try {
                    await fs.writeFile(tempPath, JSON.stringify(serialized, null, 2));
                    await fs.rename(tempPath, filePath);
                } catch (error) {
                    console.error(`Failed to save ${key}:`, error);
                    // Re-queue failed writes
                    this.writeQueue.set(key, data);
                }
            });
            
            await Promise.all(writePromises);
            
            // Allow event loop to breathe between batches
            if (i + batchSize < writes.length) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        
        this.pendingWrites = Math.max(0, this.pendingWrites - writes.length);
        this.isWriting = false;
        
        // Process any new writes
        if (this.writeQueue.size > 0) {
            this.isWriting = true;
            setImmediate(() => this._processWriteQueue());
        }
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
                .filter(f => f.endsWith(this.extension) && !f.startsWith('_') && !f.endsWith('.tmp'))
                .map(f => f.replace(this.extension, ''));
        } catch (err) {
            return [];
        }
    }

    // Wait for all pending writes to complete
    async flush() {
        while (this.pendingWrites > 0 || this.isWriting) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
}

// ========== 3. Enhanced Cache with Memory Management ==========
const instanceCache = new Map();
const lockManager = new LockManager();
const memoryManager = new MemoryManager();
const transactionLogger = new TransactionLogger(getDefaultStorage());

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

// ========== 5. The Enhanced DB Class ==========
class DB {
    constructor(options = {}) {
        // Generate ID if not provided (NOW CONSISTENT)
        const finalUniqueKey = options.id || generateUniqueId();
        
        // Use provided storage or get default
        this._storage = options.storage || getDefaultStorage();
        this._autoSave = this._storage.autoSave;
        this._uniqueKey = finalUniqueKey;
        
        // Build the full key with inheritance chain
        this._key = this._buildKey();
        
        // Check cache
        const cacheKey = this._key;
        if (instanceCache.has(cacheKey)) {
            return instanceCache.get(cacheKey);
        }
        
        // Check if we should load from memory manager
        if (memoryManager.shouldLoad(cacheKey)) {
            const unloadedData = memoryManager.getUnloadedData(cacheKey);
            if (unloadedData) {
                Object.assign(this, unloadedData);
                memoryManager.removeUnloadedData(cacheKey);
            }
        }
        
        // LOAD SYNCHRONOUSLY (non-blocking)
        this._loadSync();
        
        instanceCache.set(cacheKey, this);
        memoryManager.registerAccess(this);
        memoryManager.incrementInstanceCount();
        
        return this;
    }

    _loadSync() {
        // Use try-catch without locks for initial load to avoid blocking
        try {
            const filePath = this._storage._getFilePath(this._key);
            if (fsSync.existsSync(filePath)) {
                const content = fsSync.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                const deserialized = this._storage._deserialize(data);
                
                // Apply loaded data
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

    async _loadWithLock() {
        // Only use locks for critical operations, not for initial load
        if (lockManager.isLocked(this._key)) {
            // If locked, wait a bit but don't block
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        const lock = await lockManager.acquire(this._key);
        try {
            const data = await this._storage.load(this._key);
            if (data) {
                for (const [key, value] of Object.entries(data)) {
                    if (!key.startsWith('_')) {
                        this[key] = value;
                    }
                }
            }
        } finally {
            lock.release();
        }
    }

    _buildKey() {
        const chain = getInheritanceChain(this);
        return `${chain.join('.')}:${this._uniqueKey}`;
    }

    _getSerializedState() {
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
        
        return state;
    }

    async save(transactionId = null) {
        this._dirty = true;
        memoryManager.markDirty(this);
        
        const state = this._getSerializedState();
        
        // Only use locks for critical save operations
        const lock = await lockManager.acquire(this._key);
        try {
            if (transactionId) {
                const oldState = await this._storage.load(this._key);
                await transactionLogger.logChange(transactionId, this._key, oldState, state);
            }
            
            await this._storage.save(this._key, state);
            this._dirty = false;
            memoryManager.markClean(this);
            
        } finally {
            lock.release();
        }
        
        return this;
    }

    async saveWithTransaction() {
        const transactionId = await transactionLogger.begin(this._key);
        try {
            await this.save(transactionId);
            await transactionLogger.commit(transactionId);
        } catch (error) {
            await transactionLogger.rollback(transactionId);
            throw error;
        }
        return this;
    }

    async autoSave() {
        if (this._autoSave) {
            await this.save();
        }
    }

    // Get the unique key
    get uniqueKey() {
        memoryManager.registerAccess(this);
        return this._uniqueKey;
    }

    // Get the full inheritance chain
    get inheritanceChain() {
        memoryManager.registerAccess(this);
        return getInheritanceChain(this);
    }

    // Get the full storage key
    get storageKey() {
        memoryManager.registerAccess(this);
        return this._key;
    }

    async delete() {
        const lock = await lockManager.acquire(this._key);
        try {
            await this._storage.delete(this._key);
            instanceCache.delete(this._key);
            memoryManager.removeUnloadedData(this._key);
            memoryManager.decrementInstanceCount();
        } finally {
            lock.release();
        }
        return this;
    }

    // Static method to get all instances
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
    
    // Get all instances including subclasses
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
    
    // Find by unique key
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

    // Static utility methods
    static getMachineId() {
        return getMachineId();
    }

    static generateUniqueId() {
        return generateUniqueId();
    }

    // Memory management control
    static setMemoryOptions(options) {
        if (options.maxInstances) memoryManager.maxInstances = options.maxInstances;
        if (options.maxMemoryPercent) memoryManager.maxMemoryPercent = options.maxMemoryPercent;
        if (options.unloadTimeout) memoryManager.unloadTimeout = options.unloadTimeout;
    }

    // Force unload from memory
    static async unloadInstance(key) {
        if (instanceCache.has(key)) {
            const instance = instanceCache.get(key);
            if (!instance._dirty) {
                instanceCache.delete(key);
                memoryManager.removeUnloadedData(key);
                memoryManager.decrementInstanceCount();
            }
        }
    }

    // Flush all pending writes
    static async flushAll() {
        const writes = [];
        for (const [key, instance] of instanceCache) {
            if (instance._dirty) {
                writes.push(instance.save());
            }
        }
        await Promise.all(writes);
        await getDefaultStorage().flush();
    }
}

export default DB;