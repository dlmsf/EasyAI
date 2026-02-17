// core/ChatPrompt.js
const NewChatPrompt = {
    // Default system message that works well for most cases
    DEFAULT_SYSTEM: `You are a helpful, harmless, and honest AI assistant. 
You respond conversationally and naturally in the same language as the user.
Keep responses clear and concise unless asked for detail.`,

    /**
     * Build ChatML format with optional system message
     */
    build(messages, systemMessage = null) {
        let prompt = '';
        
        // Add system message (use default if none provided)
        const system = systemMessage || this.DEFAULT_SYSTEM;
        prompt += `<|im_start|>system\n${system}<|im_end|>\n`;
        
        // Add conversation messages
        for (const msg of messages) {
            prompt += `<|im_start|>${msg.role}\n`;
            prompt += `${msg.content}<|im_end|>\n`;
        }
        
        // Add assistant starter
        prompt += `<|im_start|>assistant\n`;
        
        return prompt;
    },

    /**
     * Alternative system messages for different use cases
     */
    SYSTEM_TYPES: {
        CONCISE: 'You are a helpful assistant. Give brief, direct answers.',
        DETAILED: 'You are a helpful assistant. Provide thorough, detailed responses.',
        CREATIVE: 'You are a creative assistant. Think outside the box.',
        PROFESSIONAL: 'You are a professional business assistant. Be formal and precise.',
        FRIENDLY: 'You are a friendly assistant. Be warm and conversational.'
    }
};

export default NewChatPrompt;