import Chat from "./Chat.js";

class ChatModule {
    constructor(){
        /** 
         * Map storing Chat instances
         * @type {Map<string, Chat>}
         */
        this.Chats = new Map();
    }

    /**
     * Creates a new chat instance
     * @param {string} name - Chat name
     * @param {Object} config - Configuration object
     * @param {Array} [config.historical] - Initial chat history
     * @param {string} [config.id] - Custom ID for the chat
     * @returns {string} The ID of the newly created chat
     */
    NewChat(name = 'New Chat', config = {historical: undefined, id: undefined}) {
        const chat = new Chat(name, config);
        this.Chats.set(chat.ID, chat);
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
     * @returns {boolean} Success status
     */
    NewMessage(chatId, sender, content, config = {id: undefined, time: false}) {
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.NewMessage(sender, content, config);
            return true;
        }
        return false;
    }

    /**
     * Alias for NewMessage - adds a new message by chat ID
     * @param {string} chatId - ID of the chat
     * @param {string} sender - Message sender
     * @param {string} content - Message content
     * @param {Object} config - Message configuration
     * @returns {boolean} Success status
     */
    NewMessageByID(chatId, sender, content, config = {id: undefined, time: false}) {
        return this.NewMessage(chatId, sender, content, config);
    }
 
    /**
     * Gets chat history for a specific chat
     * @param {string} chatId - ID of the chat
     * @param {number} [limit] - Maximum number of messages to return (returns most recent)
     * @returns {Array|null} Array of messages or null if chat not found
     */
    GetChatHistorical(chatId, limit) {
        const chat = this.Chats.get(chatId);
        if (!chat) return null;
        
        const historical = chat.Historical;
        return limit ? historical.slice(-limit) : [...historical];
    }

    /**
     * Alias for GetChatHistorical - gets chat history by ID
     * @param {string} chatId - ID of the chat
     * @param {number} [limit] - Maximum number of messages to return
     * @returns {Array|null} Array of messages or null if chat not found
     */
    GetChatHistoricalById(chatId, limit) {
        return this.GetChatHistorical(chatId, limit);
    }

    /**
     * Gets all chat IDs currently stored
     * @returns {string[]} Array of chat IDs
     */
    GetAllChatIds() {
        return Array.from(this.Chats.keys());
    }

    /**
     * Gets the total number of chats
     * @returns {number} Number of chats
     */
    GetChatCount() {
        return this.Chats.size;
    }

    /**
     * Deletes a chat by ID
     * @param {string} chatId - ID of the chat to delete
     * @returns {boolean} True if deleted, false if not found
     */
    DeleteChat(chatId) {
        return this.Chats.delete(chatId);
    }

    /**
     * Gets a chat instance by ID
     * @param {string} chatId - ID of the chat
     * @returns {Chat|undefined} Chat instance or undefined if not found
     */
    GetChat(chatId) {
        return this.Chats.get(chatId);
    }

    /**
     * Updates a chat's name
     * @param {string} chatId - ID of the chat
     * @param {string} newName - New name for the chat
     * @returns {boolean} True if updated, false if chat not found
     */
    UpdateChatName(chatId, newName) {
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.Name = newName;
            return true;
        }
        return false;
    }

    /**
     * Resets a chat's history
     * @param {string} chatId - ID of the chat
     * @returns {boolean} True if reset, false if chat not found
     */
    ResetChat(chatId) {
        const chat = this.Chats.get(chatId);
        if (chat) {
            chat.Reset();
            return true;
        }
        return false;
    }
}

export default ChatModule;