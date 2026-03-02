// In ChatModule.js or wherever your Chat class is defined
class Chat {
    constructor(name = 'New Chat', config = {}) {
        this.ID = config.id || this.generateUniqueId();
        this.Name = name;
        this.Historical = config.historical || [];
    }

    generateUniqueId() {
        // Combine timestamp, random number, and a counter to ensure uniqueness
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000000);
        const counter = this.counter || 0;
        this.counter = (this.counter || 0) + 1;
        
        return `${timestamp}-${random}-${counter}-${Math.random().toString(36).substr(2, 9)}`;
    }

    NewMessage(sender, content, config = {}) {
        // Ensure content is a clean string, not an object
        const cleanContent = typeof content === 'string' 
            ? content 
            : JSON.stringify(content);
        
        const message = {
            role: sender === 'user' ? 'user' : 'assistant',
            content: cleanContent,
            timestamp: Date.now()
        };
        
        // Generate unique ID for message if not provided
        message.id = config.id || this.generateUniqueId();
        
        if (config.time) {
            message.time = new Date().toLocaleString();
        }
        
        this.Historical.push(message);
    }

    Reset() {
        this.Historical = [];
    }
}

export default Chat;