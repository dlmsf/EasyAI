// ========== db.js - Complete Auto-Save Version ==========
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import { EventEmitter } from 'events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========== MACHINE ID GENERATION ==========
function getMachineId() {
    try {
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            for (const addr of addrs) {
                if (!addr.internal && addr.mac && addr.mac !== '00:00:00:00:00:00') {
                    return addr.mac.replace(/:/g, '');
                }
            }
        }
        return os.hostname().replace(/[^a-zA-Z0-9]/g, '');
    } catch (error) {
        return `machine-${crypto.createHash('md5').update(__dirname).digest('hex').substr(0, 8)}`;
    }
}

function generateUniqueId() {
    return getMachineId();
}

// ========== Lock Manager ==========
class LockManager {
    constructor() {
        this.locks = new Map();
        this.timeout = 5000;
    }

    async acquire(key, timeout = 5000) {
        const startTime = Date.now();
        
        while (this.locks.has(key)) {
            if (Date.now() - startTime > timeout) {
                throw new Error(`Lock acquisition timeout for key: ${key}`);
            }
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

    isLocked(key) {
        return this.locks.has(key);
    }
}

// ========== Memory Manager ==========
class MemoryManager extends EventEmitter {
    constructor(options = {}) {
        super();
        this.maxInstances = options.maxInstances || 1000;
        this.maxMemoryPercent = options.maxMemoryPercent || 70;
        this.instanceAccess = new Map();
        this.instanceData = new Map();
        this.unloadTimeout = options.unloadTimeout || 30 * 60 * 1000;
        this.checkInterval = options.checkInterval || 60 * 1000;
        this._interval = null;
        this._instanceCount = 0;
    }

    startMonitoring() {
        if (this._instanceCount > 0 && !this._interval) {
            this._interval = setInterval(() => {
                this.checkMemoryAndUnload().catch(console.error);
            }, this.checkInterval);
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
        instances.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        
        let unloaded = 0;
        const targetUnload = Math.floor(this.instanceAccess.size * 0.2);
        
        for (const [key, data] of instances) {
            if (unloaded >= targetUnload) break;
            
            if (now - data.lastAccess > this.unloadTimeout && !data.dirty) {
                this.instanceData.set(key, data.serialized);
                this.instanceAccess.delete(key);
                this.emit('instanceUnloaded', key);
                unloaded++;
            }
        }
    }

    registerAccess(instance) {
        const key = instance.__storageKey;
        this.instanceAccess.set(key, {
            lastAccess: Date.now(),
            dirty: instance.__dirty || false,
            serialized: instance.__getSerializedState()
        });
    }

    markDirty(instance) {
        const key = instance.__storageKey;
        const data = this.instanceAccess.get(key);
        if (data) {
            data.dirty = true;
            data.lastAccess = Date.now();
        }
    }

    markClean(instance) {
        const key = instance.__storageKey;
        const data = this.instanceAccess.get(key);
        if (data) {
            data.dirty = false;
            data.serialized = instance.__getSerializedState();
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

// ========== Transaction Logger ==========
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

// ========== Default Storage ==========
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

// ========== JSON Storage ==========
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
        this.writeQueue.set(key, data);
        
        if (!this.isWriting) {
            this.isWriting = true;
            setImmediate(() => this._processWriteQueue());
        }
    }

    async _processWriteQueue() {
        const writes = Array.from(this.writeQueue.entries());
        this.writeQueue.clear();
        
        const batchSize = 5;
        for (let i = 0; i < writes.length; i += batchSize) {
            const batch = writes.slice(i, i + batchSize);
            
            const writePromises = batch.map(async ([key, data]) => {
                const filePath = this._getFilePath(key);
                const serialized = this._serialize(data);
                
                const tempPath = `${filePath}.tmp`;
                try {
                    await fs.writeFile(tempPath, JSON.stringify(serialized, null, 2));
                    await fs.rename(tempPath, filePath);
                } catch (error) {
                    console.error(`Failed to save ${key}:`, error);
                    this.writeQueue.set(key, data);
                }
            });
            
            await Promise.all(writePromises);
            
            if (i + batchSize < writes.length) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        
        this.pendingWrites = Math.max(0, this.pendingWrites - writes.length);
        this.isWriting = false;
        
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

    async flush() {
        while (this.pendingWrites > 0 || this.isWriting) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
}

// ========== Enhanced Cache ==========
const instanceCache = new Map();
const lockManager = new LockManager();
const memoryManager = new MemoryManager();
const transactionLogger = new TransactionLogger(getDefaultStorage());
const pendingSaves = new Map(); // Debounce saves
const SAVE_DEBOUNCE_TIME = 100; // 100ms

// ========== Auto-Save Proxy Creator ==========
function createAutoSaveProxy(instance) {
    let saveTimeout = null;
    
    // Schedule a save with debouncing
    const scheduleSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            instance.__save().catch(console.error);
            saveTimeout = null;
        }, SAVE_DEBOUNCE_TIME);
    };
    
    // Recursive proxy creator for nested objects
    const createNestedProxy = (target, path = []) => {
        return new Proxy(target, {
            set(obj, prop, value) {
                // Skip internal properties
                if (prop === '__isProxy' || prop === '__target') {
                    obj[prop] = value;
                    return true;
                }
                
                // Handle the set
                obj[prop] = value;
                
                // Mark as dirty and schedule save
                instance.__dirty = true;
                memoryManager.markDirty(instance);
                scheduleSave();
                
                return true;
            },
            
            get(obj, prop) {
                // Special properties
                if (prop === '__isProxy') return true;
                if (prop === '__target') return obj;
                
                const value = obj[prop];
                
                // Create proxy for nested objects/arrays
                if (value && typeof value === 'object' && !value.__isProxy) {
                    // Don't proxy DB instances
                    if (value instanceof DB) return value;
                    
                    // Create proxy for this nested object
                    const nestedPath = [...path, prop];
                    obj[prop] = createNestedProxy(value, nestedPath);
                    return obj[prop];
                }
                
                return value;
            },
            
            deleteProperty(obj, prop) {
                delete obj[prop];
                
                instance.__dirty = true;
                memoryManager.markDirty(instance);
                scheduleSave();
                
                return true;
            }
        });
    };
    
    // Wrap all methods to detect changes
    const wrapMethod = (obj, methodName, originalMethod) => {
        return function(...args) {
            const result = originalMethod.apply(this, args);
            
            // If method modifies the object, schedule save
            instance.__dirty = true;
            memoryManager.markDirty(instance);
            scheduleSave();
            
            return result;
        };
    };
    
    // Create main instance proxy
    return new Proxy(instance, {
        set(target, prop, value) {
            // Skip internal properties
            if (prop.startsWith('__') || prop === 'constructor') {
                target[prop] = value;
                return true;
            }
            
            // Handle the set
            target[prop] = value;
            
            // Mark as dirty and schedule save
            target.__dirty = true;
            memoryManager.markDirty(target);
            scheduleSave();
            
            return true;
        },
        
        get(target, prop) {
            // Internal properties
            if (prop === '__isProxy') return true;
            if (prop === '__target') return target;
            
            // Get the value
            const value = target[prop];
            
            // Handle methods
            if (typeof value === 'function' && prop !== 'constructor') {
                // Wrap the method to detect changes
                return wrapMethod(target, prop, value);
            }
            
            // Handle nested objects
            if (value && typeof value === 'object' && !value.__isProxy) {
                // Don't proxy DB instances
                if (value instanceof DB) return value;
                
                // Create proxy for this nested object
                target[prop] = createNestedProxy(value, [prop]);
                return target[prop];
            }
            
            return value;
        },
        
        deleteProperty(target, prop) {
            if (prop.startsWith('__')) {
                delete target[prop];
                return true;
            }
            
            delete target[prop];
            
            target.__dirty = true;
            memoryManager.markDirty(target);
            scheduleSave();
            
            return true;
        }
    });
}

// ========== Helper to get inheritance chain ==========
function getInheritanceChain(obj) {
    const chain = [];
    let proto = obj.constructor;
    
    while (proto && proto.name && proto !== DB && proto !== Object) {
        chain.unshift(proto.name);
        proto = Object.getPrototypeOf(proto);
    }
    
    return chain;
}

// ========== The Enhanced DB Class ==========
class DB {
    constructor(options = {}) {
        // Generate ID if not provided
        const finalUniqueKey = options.id || generateUniqueId();
        
        // Use provided storage or get default
        this.__storage = options.storage || getDefaultStorage();
        this.__autoSave = this.__storage.autoSave;
        this.__uniqueKey = finalUniqueKey;
        
        // Build the full key with inheritance chain
        this.__buildKey();
        
        // Check cache
        const cacheKey = this.__storageKey;
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
        
        // Load existing data
        this.__loadSync();
        
        // Initialize state
        this.__dirty = false;
        
        // Add to cache
        instanceCache.set(cacheKey, this);
        memoryManager.registerAccess(this);
        memoryManager.incrementInstanceCount();
        
        // Return auto-save proxy
        return createAutoSaveProxy(this);
    }

    __buildKey() {
        const chain = getInheritanceChain(this);
        this.__storageKey = `${chain.join('.')}:${this.__uniqueKey}`;
    }

    __loadSync() {
        try {
            const filePath = this.__storage._getFilePath(this.__storageKey);
            if (fsSync.existsSync(filePath)) {
                const content = fsSync.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                const deserialized = this.__storage._deserialize(data);
                
                // Apply loaded data
                for (const [key, value] of Object.entries(deserialized)) {
                    if (!key.startsWith('__')) {
                        this[key] = value;
                    }
                }
            }
        } catch (err) {
            // File doesn't exist or error loading - start fresh
        }
    }

    async __loadWithLock() {
        if (lockManager.isLocked(this.__storageKey)) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        const lock = await lockManager.acquire(this.__storageKey);
        try {
            const data = await this.__storage.load(this.__storageKey);
            if (data) {
                for (const [key, value] of Object.entries(data)) {
                    if (!key.startsWith('__')) {
                        this[key] = value;
                    }
                }
            }
        } finally {
            lock.release();
        }
    }

    __getSerializedState() {
        const state = {};
        
        // Get all enumerable properties
        for (const key in this) {
            if (key.startsWith('__') || key === 'constructor') continue;
            state[key] = this[key];
        }
        
        return state;
    }

    async __save(transactionId = null) {
        // Skip if not dirty
        if (!this.__dirty) return this;
        
        const state = this.__getSerializedState();
        
        const lock = await lockManager.acquire(this.__storageKey);
        try {
            if (transactionId) {
                const oldState = await this.__storage.load(this.__storageKey);
                await transactionLogger.logChange(transactionId, this.__storageKey, oldState, state);
            }
            
            await this.__storage.save(this.__storageKey, state);
            this.__dirty = false;
            memoryManager.markClean(this);
            
        } finally {
            lock.release();
        }
        
        return this;
    }

    async saveWithTransaction() {
        const transactionId = await transactionLogger.begin(this.__storageKey);
        try {
            await this.__save(transactionId);
            await transactionLogger.commit(transactionId);
        } catch (error) {
            await transactionLogger.rollback(transactionId);
            throw error;
        }
        return this;
    }

    // Public API
    get uniqueKey() {
        memoryManager.registerAccess(this);
        return this.__uniqueKey;
    }

    get inheritanceChain() {
        memoryManager.registerAccess(this);
        return getInheritanceChain(this);
    }

    get storageKey() {
        memoryManager.registerAccess(this);
        return this.__storageKey;
    }

    async delete() {
        const lock = await lockManager.acquire(this.__storageKey);
        try {
            await this.__storage.delete(this.__storageKey);
            instanceCache.delete(this.__storageKey);
            memoryManager.removeUnloadedData(this.__storageKey);
            memoryManager.decrementInstanceCount();
        } finally {
            lock.release();
        }
        return this;
    }

    async reload() {
        await this.__loadWithLock();
        this.__dirty = false;
        memoryManager.markClean(this);
        return this;
    }

    // Static methods
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

    static getMachineId() {
        return getMachineId();
    }

    static generateUniqueId() {
        return generateUniqueId();
    }

    static setMemoryOptions(options) {
        if (options.maxInstances) memoryManager.maxInstances = options.maxInstances;
        if (options.maxMemoryPercent) memoryManager.maxMemoryPercent = options.maxMemoryPercent;
        if (options.unloadTimeout) memoryManager.unloadTimeout = options.unloadTimeout;
    }

    static async unloadInstance(key) {
        if (instanceCache.has(key)) {
            const instance = instanceCache.get(key);
            if (!instance.__dirty) {
                instanceCache.delete(key);
                memoryManager.removeUnloadedData(key);
                memoryManager.decrementInstanceCount();
            }
        }
    }

    static async flushAll() {
        const saves = [];
        for (const [key, instance] of instanceCache) {
            if (instance.__dirty) {
                saves.push(instance.__save());
            }
        }
        await Promise.all(saves);
        await getDefaultStorage().flush();
    }
}

export default DB;