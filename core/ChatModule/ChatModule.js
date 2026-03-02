import Chat from "./Chat.js";

// ============================================================================
// STORAGE INTERFACE - Base contract for all storage implementations
// ============================================================================

/**
 * @interface StorageInterface
 * Base interface that all storage modules must implement
 */
class StorageInterface {
    /**
     * Initialize the storage (create directories, connect to DB, etc.)
     * @returns {Promise<void>}
     */
    async init() { throw new Error('Method not implemented'); }
    
    /**
     * Save a chat to permanent storage
     * @param {string} chatId - Chat identifier
     * @param {Object} chatData - Chat data to save
     * @returns {Promise<void>}
     */
    async saveChat(chatId, chatData) { throw new Error('Method not implemented'); }
    
    /**
     * Load a specific chat from storage
     * @param {string} chatId - Chat identifier
     * @returns {Promise<Object|null>} Chat data or null if not found
     */
    async loadChat(chatId) { throw new Error('Method not implemented'); }
    
    /**
     * Load all chats from storage
     * @returns {Promise<Object>} Object with chatId as keys and chat data as values
     */
    async loadAllChats() { throw new Error('Method not implemented'); }
    
    /**
     * Delete a chat from storage
     * @param {string} chatId - Chat identifier
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async deleteChat(chatId) { throw new Error('Method not implemented'); }
    
    /**
     * Check if a chat exists in storage
     * @param {string} chatId - Chat identifier
     * @returns {Promise<boolean>}
     */
    async chatExists(chatId) { throw new Error('Method not implemented'); }
}

// ============================================================================
// JSON FILE STORAGE IMPLEMENTATION
// ============================================================================

import fs from 'fs/promises';
import path from 'path';

/**
 * JSON file-based storage implementation
 * @implements {StorageInterface}
 */
class JsonStorage extends StorageInterface {
    /**
     * @param {string} storagePath - Directory path for storing JSON files
     */
    constructor(storagePath = './chat_storage') {
        super();
        this.storagePath = storagePath;
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            try {
                await fs.mkdir(this.storagePath, { recursive: true });
                this.initialized = true;
            } catch (error) {
                console.error('Failed to initialize JSON storage:', error);
                throw error;
            }
        }
    }

    async saveChat(chatId, chatData) {
        await this.init();
        const filePath = path.join(this.storagePath, `${chatId}.json`);
        await fs.writeFile(filePath, JSON.stringify(chatData, null, 2), 'utf8');
    }

    async loadChat(chatId) {
        await this.init();
        const filePath = path.join(this.storagePath, `${chatId}.json`);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    }

    async loadAllChats() {
        await this.init();
        try {
            const files = await fs.readdir(this.storagePath);
            const jsonFiles = files.filter(f => f.endsWith('.json'));
            
            const chats = {};
            for (const file of jsonFiles) {
                const chatId = path.basename(file, '.json');
                const data = await this.loadChat(chatId);
                if (data) chats[chatId] = data;
            }
            return chats;
        } catch (error) {
            if (error.code === 'ENOENT') return {};
            throw error;
        }
    }

    async deleteChat(chatId) {
        await this.init();
        const filePath = path.join(this.storagePath, `${chatId}.json`);
        try {
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') return false;
            throw error;
        }
    }

    async chatExists(chatId) {
        await this.init();
        const filePath = path.join(this.storagePath, `${chatId}.json`);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

// ============================================================================
// MEMORY STORAGE IMPLEMENTATION (for testing/fallback)
// ============================================================================

/**
 * In-memory storage implementation
 * @implements {StorageInterface}
 */
class MemoryStorage extends StorageInterface {
    constructor() {
        super();
        this.chats = new Map();
    }

    async init() {
        return Promise.resolve();
    }

    async saveChat(chatId, chatData) {
        this.chats.set(chatId, JSON.parse(JSON.stringify(chatData))); // Deep copy
        return Promise.resolve();
    }

    async loadChat(chatId) {
        const data = this.chats.get(chatId);
        return data ? JSON.parse(JSON.stringify(data)) : null;
    }

    async loadAllChats() {
        const chats = {};
        for (const [chatId, data] of this.chats) {
            chats[chatId] = JSON.parse(JSON.stringify(data));
        }
        return chats;
    }

    async deleteChat(chatId) {
        return Promise.resolve(this.chats.delete(chatId));
    }

    async chatExists(chatId) {
        return Promise.resolve(this.chats.has(chatId));
    }
}

// ============================================================================
// POSTGRESQL STORAGE IMPLEMENTATION TEMPLATE (example for database)
// ============================================================================

/**
 * PostgreSQL storage implementation (template)
 * @implements {StorageInterface}
 * @note Requires 'pg' package to be installed
 */
class PostgreSQLStorage extends StorageInterface {
    /**
     * @param {Object} connectionConfig - PostgreSQL connection configuration
     */
    constructor(connectionConfig) {
        super();
        this.config = connectionConfig;
        this.pool = null;
    }

    async init() {
        // Dynamic import to avoid requiring pg if not used
        try {
            const { Pool } = await import('pg');
            this.pool = new Pool(this.config);
            
            // Create table if not exists
            await this.pool.query(`
                CREATE TABLE IF NOT EXISTS chats (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(255),
                    data JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
        } catch (error) {
            console.error('Failed to initialize PostgreSQL storage:', error);
            throw new Error('PostgreSQL storage requires "pg" package to be installed');
        }
    }

    async saveChat(chatId, chatData) {
        if (!this.pool) await this.init();
        
        const query = `
            INSERT INTO chats (id, name, data, updated_at) 
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE 
            SET data = $3, name = $2, updated_at = CURRENT_TIMESTAMP
        `;
        await this.pool.query(query, [chatId, chatData.Name, JSON.stringify(chatData)]);
    }

    async loadChat(chatId) {
        if (!this.pool) await this.init();
        
        const result = await this.pool.query(
            'SELECT data FROM chats WHERE id = $1',
            [chatId]
        );
        return result.rows[0]?.data || null;
    }

    async loadAllChats() {
        if (!this.pool) await this.init();
        
        const result = await this.pool.query('SELECT id, data FROM chats');
        const chats = {};
        for (const row of result.rows) {
            chats[row.id] = row.data;
        }
        return chats;
    }

    async deleteChat(chatId) {
        if (!this.pool) await this.init();
        
        const result = await this.pool.query(
            'DELETE FROM chats WHERE id = $1 RETURNING id',
            [chatId]
        );
        return result.rowCount > 0;
    }

    async chatExists(chatId) {
        if (!this.pool) await this.init();
        
        const result = await this.pool.query(
            'SELECT 1 FROM chats WHERE id = $1',
            [chatId]
        );
        return result.rowCount > 0;
    }
}

// ============================================================================
// MAIN CHAT MODULE WITH STORAGE SUPPORT
// ============================================================================

class ChatModule {
    /**
     * @param {Object} options - Configuration options
     * @param {StorageInterface} [options.storage] - Storage implementation (defaults to JsonStorage)
     * @param {boolean} [options.autoSave] - Automatically save changes (default: true)
     * @param {number} [options.saveDelay] - Debounce delay for auto-save in ms (default: 1000)
     */
    constructor(options = {}) {
        /** 
         * Map storing Chat instances in memory
         * @type {Map<string, Chat>}
         */
        this.Chats = new Map();
        
        /** @type {StorageInterface} */
        this.storage = options.storage || new JsonStorage();
        
        /** @type {boolean} */
        this.autoSave = options.autoSave !== false;
        
        /** @type {number} */
        this.saveDelay = options.saveDelay || 1000;
        
        /** @type {Map<string, NodeJS.Timeout>} */
        this.saveTimeouts = new Map();
        
        /** @type {boolean} */
        this.initialized = false;
    }

    /**
     * Initialize the module and load existing chats from storage
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;
        
        await this.storage.init();
        
        // Load all existing chats from storage
        const savedChats = await this.storage.loadAllChats();
        
        for (const [chatId, chatData] of Object.entries(savedChats)) {
            // Reconstruct Chat instances from saved data
            const chat = new Chat(chatData.Name, {
                id: chatId,
                historical: chatData.Historical
            });
            this.Chats.set(chatId, chat);
        }
        
        this.initialized = true;
        console.log(`ChatModule initialized with ${this.Chats.size} chats`);
    }

    /**
     * Saves a specific chat to storage
     * @param {string} chatId 
     * @returns {Promise<boolean>}
     */
    async saveChat(chatId) {
        const chat = this.Chats.get(chatId);
        if (!chat) return false;
        
        await this.storage.saveChat(chatId, {
            ID: chat.ID,
            Name: chat.Name,
            Historical: chat.Historical
        });
        return true;
    }

    /**
     * Debounced save to prevent too many writes
     * @param {string} chatId 
     */
    scheduleSave(chatId) {
        if (!this.autoSave) return;
        
        // Clear existing timeout
        const existingTimeout = this.saveTimeouts.get(chatId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        // Schedule new save
        const timeout = setTimeout(async () => {
            await this.saveChat(chatId);
            this.saveTimeouts.delete(chatId);
        }, this.saveDelay);
        
        this.saveTimeouts.set(chatId, timeout);
    }

    // ========================================================================
    // ASYNC METHODS (Recommended for production use)
    // ========================================================================

    /**
     * Creates a new chat instance
     * @param {string} name - Chat name
     * @param {Object} config - Configuration object
     * @param {Array} [config.historical] - Initial chat history
     * @param {string} [config.id] - Custom ID for the chat
     * @returns {Promise<string>} The ID of the newly created chat
     */
    async NewChat(name = 'New Chat', config = {historical: undefined, id: undefined}) {
        if (!this.initialized) await this.init();
        
        const chat = new Chat(name, config);
        this.Chats.set(chat.ID, chat);
        
        // Save immediately for new chats
        await this.saveChat(chat.ID);
        
        return chat.ID;
    }

    /**
     * Adds a new message to a specific chat
     * @param {string} chatId - ID of the chat
     * @param {string} sender - Message sender ('user' or 'assistant')
     * @param {string} content - Message content
     * @param {Object} config - Message configuration
     * @param {string} [config.id] - Custom message ID
     * @param {boolean} [config.time] - Whether to add timestamp
     * @returns {Promise<boolean>} Success status
     */
    async NewMessage(chatId, sender, content, config = {id: undefined, time: false}) {
        if (!this.initialized) await this.init();
        
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.NewMessage(sender, content, config);
            this.scheduleSave(chatId);
            return true;
        }
        return false;
    }

    /**
     * Gets chat history for a specific chat
     * @param {string} chatId - ID of the chat
     * @param {number} [limit] - Maximum number of messages to return (returns most recent)
     * @returns {Promise<Array|null>} Array of messages or null if chat not found
     */
    async GetChatHistorical(chatId, limit) {
        if (!this.initialized) await this.init();
        
        const chat = this.Chats.get(chatId);
        if (!chat) {
            // Try to load from storage
            const savedData = await this.storage.loadChat(chatId);
            if (savedData) {
                // Reconstruct chat
                const loadedChat = new Chat(savedData.Name, {
                    id: chatId,
                    historical: savedData.Historical
                });
                this.Chats.set(chatId, loadedChat);
                const historical = loadedChat.Historical;
                return limit ? historical.slice(-limit) : [...historical];
            }
            return null;
        }
        
        const historical = chat.Historical;
        return limit ? historical.slice(-limit) : [...historical];
    }

    /**
     * Alias for GetChatHistorical
     * @param {string} chatId - ID of the chat
     * @param {number} [limit] - Maximum number of messages to return
     * @returns {Promise<Array|null>}
     */
    async GetChatHistoricalById(chatId, limit) {
        return this.GetChatHistorical(chatId, limit);
    }

    /**
     * Gets all chat IDs currently stored
     * @returns {Promise<string[]>} Array of chat IDs
     */
    async GetAllChatIds() {
        if (!this.initialized) await this.init();
        return Array.from(this.Chats.keys());
    }

    /**
     * Updates a chat's name
     * @param {string} chatId - ID of the chat
     * @param {string} newName - New name for the chat
     * @returns {Promise<boolean>} True if updated, false if chat not found
     */
    async UpdateChatName(chatId, newName) {
        if (!this.initialized) await this.init();
        
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.Name = newName;
            this.scheduleSave(chatId);
            return true;
        }
        return false;
    }

    /**
     * Resets a chat's history
     * @param {string} chatId - ID of the chat
     * @returns {Promise<boolean>} True if reset, false if chat not found
     */
    async ResetChat(chatId) {
        if (!this.initialized) await this.init();
        
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.Reset();
            this.scheduleSave(chatId);
            return true;
        }
        return false;
    }

    /**
     * Deletes a chat by ID
     * @param {string} chatId - ID of the chat to delete
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async DeleteChat(chatId) {
        if (!this.initialized) await this.init();
        
        // Clear any pending save
        const timeout = this.saveTimeouts.get(chatId);
        if (timeout) {
            clearTimeout(timeout);
            this.saveTimeouts.delete(chatId);
        }
        
        // Remove from memory
        const deleted = this.Chats.delete(chatId);
        
        // Remove from storage
        await this.storage.deleteChat(chatId);
        
        return deleted;
    }

    /**
     * Ensures all pending saves are completed
     * @returns {Promise<void>}
     */
    async flush() {
        // Clear all pending timeouts and save immediately
        const savePromises = [];
        
        for (const [chatId, timeout] of this.saveTimeouts) {
            clearTimeout(timeout);
            savePromises.push(this.saveChat(chatId));
        }
        
        this.saveTimeouts.clear();
        await Promise.all(savePromises);
    }

    // ========================================================================
    // SYNC METHODS (For backward compatibility and non-async contexts)
    // ========================================================================

    /**
     * Synchronous version of NewChat
     * @param {string} name - Chat name
     * @param {Object} config - Configuration object
     * @returns {string} The ID of the newly created chat
     */
    NewChatSync(name = 'New Chat', config = {historical: undefined, id: undefined}) {
        const chat = new Chat(name, config);
        this.Chats.set(chat.ID, chat);
        
        // Fire and forget save
        this.saveChat(chat.ID).catch(console.error);
        
        return chat.ID;
    }

    /**
     * Synchronous version of NewMessage
     * @param {string} chatId - ID of the chat
     * @param {string} sender - Message sender
     * @param {string} content - Message content
     * @param {Object} config - Message configuration
     * @returns {boolean} Success status
     */
    NewMessageSync(chatId, sender, content, config = {id: undefined, time: false}) {
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.NewMessage(sender, content, config);
            this.scheduleSave(chatId);
            return true;
        }
        return false;
    }

    /**
     * Synchronous version of NewMessageByID
     * @param {string} chatId - ID of the chat
     * @param {string} sender - Message sender
     * @param {string} content - Message content
     * @param {Object} config - Message configuration
     * @returns {boolean} Success status
     */
    NewMessageByID(chatId, sender, content, config = {id: undefined, time: false}) {
        return this.NewMessageSync(chatId, sender, content, config);
    }

    /**
     * Synchronous version of GetChatHistorical
     * @param {string} chatId - ID of the chat
     * @param {number} [limit] - Maximum number of messages to return
     * @returns {Array|null} Array of messages or null if chat not found
     */
    GetChatHistoricalSync(chatId, limit) {
        const chat = this.Chats.get(chatId);
        if (!chat) return null;
        
        const historical = chat.Historical;
        return limit ? historical.slice(-limit) : [...historical];
    }

    /**
     * Synchronous version of GetChatHistoricalById
     * @param {string} chatId - ID of the chat
     * @param {number} [limit] - Maximum number of messages to return
     * @returns {Array|null}
     */
    GetChatHistoricalByIdSync(chatId, limit) {
        return this.GetChatHistoricalSync(chatId, limit);
    }

    /**
     * Gets the total number of chats (sync)
     * @returns {number} Number of chats
     */
    GetChatCount() {
        return this.Chats.size;
    }

    /**
     * Gets a chat instance by ID (sync)
     * @param {string} chatId - ID of the chat
     * @returns {Chat|undefined} Chat instance or undefined if not found
     */
    GetChat(chatId) {
        return this.Chats.get(chatId);
    }

    /**
     * Synchronous version of GetAllChatIds
     * @returns {string[]} Array of chat IDs
     */
    GetAllChatIdsSync() {
        return Array.from(this.Chats.keys());
    }

    /**
     * Synchronous version of UpdateChatName
     * @param {string} chatId - ID of the chat
     * @param {string} newName - New name for the chat
     * @returns {boolean} True if updated, false if chat not found
     */
    UpdateChatNameSync(chatId, newName) {
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.Name = newName;
            this.scheduleSave(chatId);
            return true;
        }
        return false;
    }

    /**
     * Synchronous version of ResetChat
     * @param {string} chatId - ID of the chat
     * @returns {boolean} True if reset, false if chat not found
     */
    ResetChatSync(chatId) {
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.Reset();
            this.scheduleSave(chatId);
            return true;
        }
        return false;
    }

    /**
     * Synchronous version of DeleteChat
     * @param {string} chatId - ID of the chat to delete
     * @returns {boolean} True if deleted, false if not found
     */
    DeleteChatSync(chatId) {
        // Clear any pending save
        const timeout = this.saveTimeouts.get(chatId);
        if (timeout) {
            clearTimeout(timeout);
            this.saveTimeouts.delete(chatId);
        }
        
        // Remove from memory
        const deleted = this.Chats.delete(chatId);
        
        // Fire and forget delete from storage
        if (deleted) {
            this.storage.deleteChat(chatId).catch(console.error);
        }
        
        return deleted;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

export default ChatModule;
export { JsonStorage, MemoryStorage, PostgreSQLStorage, StorageInterface };