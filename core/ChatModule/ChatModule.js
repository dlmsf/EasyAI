import Chat from "./Chat.js";
import DB from '../DB.js'
import os from 'os';

// ============================================================================
// HELPER FUNCTION TO GENERATE UNIQUE ID
// ============================================================================

/**
 * Generates a unique ID using machine ID
 * @returns {string} Unique identifier
 */
function generateUniqueId() {
    const machineId = getMachineId();
    return `${machineId}`;
}

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

// ============================================================================
// MAIN CHAT MODULE EXTENDING DB
// ============================================================================

class ChatModule extends DB {
    /**
     * @param {string} [uniqueId] - Optional unique identifier. If not provided, uses machineID
     * @param {Object} options - Configuration options
     * @param {StorageConnection} [options.storage] - Storage implementation
     * @param {boolean} [options.autoSave] - Automatically save changes (default: true)
     */
    constructor(uniqueId, options = {}) {
        // Generate ID if not provided
        const id = uniqueId || generateUniqueId();
        
        // Set up storage
        const storage = options.storage;
        
        // Call DB constructor
        super(id, storage);
        
        // Initialize ChatModule specific properties
        /** 
         * Map storing Chat instances in memory
         * @type {Map<string, Chat>}
         */
        this.Chats = new Map();
        
        /** @type {boolean} */
        this.enableAutoSave = options.autoSave !== false;
        
        /** @type {Map<string, NodeJS.Timeout>} */
        this.saveTimeouts = new Map();
        
        // Load saved chats from storage (convert stored array back to Map)
        this._loadChatsFromStorage();
    }

    /**
     * Loads chats from the DB storage
     * @private
     */
    _loadChatsFromStorage() {
        // Check if we have saved chats array in the DB
        // The DB class automatically loads data into instance properties
        if (this.ChatsArray && Array.isArray(this.ChatsArray)) {
            this.Chats.clear();
            for (const chatData of this.ChatsArray) {
                try {
                    const chat = new Chat(chatData.Name, {
                        id: chatData.ID,
                        historical: chatData.Historical || []
                    });
                    this.Chats.set(chatData.ID, chat);
                } catch (error) {
                    console.error(`Failed to load chat ${chatData.ID}:`, error);
                }
            }
            // Delete the temporary array property
            delete this.ChatsArray;
        }
    }

    /**
     * Converts Map to array for storage
     * @private
     */
    _prepareForSave() {
        // Convert Map to array for storage (Maps don't serialize well)
        this.ChatsArray = Array.from(this.Chats.entries()).map(([id, chat]) => ({
            ID: chat.ID,
            Name: chat.Name,
            Historical: chat.Historical || []
        }));
    }

    /**
     * Saves the entire ChatModule state to storage
     * @returns {Promise<void>}
     */
    async saveModule() {
        this._prepareForSave();
        await super.autoSave();
        // Clean up after save
        delete this.ChatsArray;
    }

    /**
     * Debounced save to prevent too many writes
     * @param {string} chatId 
     */
    scheduleSave(chatId) {
        if (!this.enableAutoSave) return;
        
        // Clear existing timeout
        const existingTimeout = this.saveTimeouts.get(chatId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        // Schedule new save
        const timeout = setTimeout(async () => {
            await this.saveModule();
            this.saveTimeouts.delete(chatId);
        }, 1000);
        
        this.saveTimeouts.set(chatId, timeout);
    }

    // ========================================================================
    // ASYNC METHODS
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
        const chat = new Chat(name, config);
        this.Chats.set(chat.ID, chat);
        
        // Save immediately for new chats
        await this.saveModule();
        
        return chat.ID;
    }

    /**
     * Adds a new message to a specific chat
     * @param {string} chatId - ID of the chat
     * @param {string} sender - Message sender ('user' or 'assistant')
     * @param {string} content - Message content
     * @param {Object} config - Message configuration
     * @returns {Promise<boolean>} Success status
     */
    async NewMessage(chatId, sender, content, config = {id: undefined, time: false}) {
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
     * @param {number} [limit] - Maximum number of messages to return
     * @returns {Promise<Array|null>} Array of messages or null if chat not found
     */
    async GetChatHistorical(chatId, limit) {
        const chat = this.Chats.get(chatId);
        if (!chat) return null;
        
        const historical = chat.Historical || [];
        return limit ? historical.slice(-limit) : [...historical];
    }

    /**
     * Alias for GetChatHistorical
     */
    async GetChatHistoricalById(chatId, limit) {
        return this.GetChatHistorical(chatId, limit);
    }

    /**
     * Gets all chat IDs currently stored
     * @returns {Promise<string[]>} Array of chat IDs
     */
    async GetAllChatIds() {
        return Array.from(this.Chats.keys());
    }

    /**
     * Updates a chat's name
     * @param {string} chatId - ID of the chat
     * @param {string} newName - New name for the chat
     * @returns {Promise<boolean>} True if updated, false if chat not found
     */
    async UpdateChatName(chatId, newName) {
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
        // Clear any pending save
        const timeout = this.saveTimeouts.get(chatId);
        if (timeout) {
            clearTimeout(timeout);
            this.saveTimeouts.delete(chatId);
        }
        
        // Remove from memory
        const deleted = this.Chats.delete(chatId);
        
        if (deleted) {
            await this.saveModule();
        }
        
        return deleted;
    }

    /**
     * Ensures all pending saves are completed
     * @returns {Promise<void>}
     */
    async flush() {
        // Clear all pending timeouts and save immediately
        for (const [chatId, timeout] of this.saveTimeouts) {
            clearTimeout(timeout);
        }
        this.saveTimeouts.clear();
        await this.saveModule();
    }

    // ========================================================================
    // SYNC METHODS (For backward compatibility)
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
        this.saveModule().catch(console.error);
        
        return chat.ID;
    }

    /**
     * Synchronous version of NewMessage
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
     * Alias for NewMessageSync
     */
    NewMessageByID(chatId, sender, content, config = {id: undefined, time: false}) {
        return this.NewMessageSync(chatId, sender, content, config);
    }

    /**
     * Synchronous version of GetChatHistorical
     */
    GetChatHistoricalSync(chatId, limit) {
        const chat = this.Chats.get(chatId);
        if (!chat) return null;
        
        const historical = chat.Historical || [];
        return limit ? historical.slice(-limit) : [...historical];
    }

    /**
     * Alias for GetChatHistoricalSync
     */
    GetChatHistoricalByIdSync(chatId, limit) {
        return this.GetChatHistoricalSync(chatId, limit);
    }

    /**
     * Gets the total number of chats
     */
    GetChatCount() {
        return this.Chats.size;
    }

    /**
     * Gets a chat instance by ID
     */
    GetChat(chatId) {
        return this.Chats.get(chatId);
    }

    /**
     * Synchronous version of GetAllChatIds
     */
    GetAllChatIdsSync() {
        return Array.from(this.Chats.keys());
    }

    /**
     * Synchronous version of UpdateChatName
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
        
        if (deleted) {
            // Fire and forget save
            this.saveModule().catch(console.error);
        }
        
        return deleted;
    }
}

export default ChatModule;