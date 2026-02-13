import readline from 'readline';

/**
 * Represents a chat terminal that processes user input and displays responses.
 * The "AI:" prefix and the AI-generated tokens are displayed in different colors for clarity.
 */
class TerminalChat {
  /**
   * Creates an instance of TerminalChat.
   * @param {(input: string, displayToken: (token: string) => Promise<void>) => Promise<void>} processInputFunction 
   *        A function that takes user input and a function to display tokens one by one in a specific color.
   * @param {Object} [config] - Configuration object for the TerminalChat.
   * @param {Function} [config.exitFunction] - Optional function to execute on chat exit.
   */
  constructor(processInputFunction, config = {}) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.processInputFunction = processInputFunction;
    this.config = config;
    this.initChat();
  }

  /**
   * Initializes the chat interface, setting up input handling and the initial prompt.
   */
  initChat() {
    this.rl.on('line', async (line) => {
      await this.processInput(line.trim());
      this.rl.prompt();
    }).on('close', () => {
      if (typeof this.config.exitFunction === 'function') {
        this.config.exitFunction();
      } else {
        console.log('\nChat ended.');
        process.exit(0);
      }
    });

    this.rl.setPrompt('User: ');
    this.rl.prompt();
  }

  /**
   * Processes user input, displaying the "AI:" prefix in cyan. 
   * The AI-generated tokens will be displayed in a different color by the displayToken method.
   * @param {string} input - The user input.
   */
  async processInput(input) {
    const colorCyan = '\x1b[36m'; // ANSI escape code for cyan
    const resetColor = '\x1b[0m'; // ANSI escape code to reset the color
    process.stdout.write(colorCyan + 'AI: ' + resetColor);
    await this.processInputFunction(input, this.displayToken.bind(this));
    process.stdout.write('\n');
  }

  /**
   * Displays a token in magenta, different from the color of the "AI:" prefix.
   * @param {string} token - The token to display.
   */
  async displayToken(token) {
    const colorMagenta = '\x1b[35m'; // ANSI escape code for magenta
    const resetColor = '\x1b[0m'; // ANSI escape code to reset the color
    process.stdout.write(colorMagenta + token + resetColor);
  }
}

export default TerminalChat;

/**
 * DeepInfra DeepSeek API Client
 * A complete client for interacting with DeepSeek models on DeepInfra with streaming support
 */
class DeepSeekClient {
    /**
     * Creates a new DeepSeek API client instance
     * @param {Object} config - Configuration object
     * @param {string} config.apiKey - Your DeepInfra API key
     * @param {string} [config.baseURL='https://api.deepinfra.com/v1/inference'] - Base API URL
     * @param {string} [config.model='deepseek-ai/DeepSeek-V3.2'] - Model identifier
     * @param {number} [config.timeout=30000] - Request timeout in milliseconds
     */
    constructor(config) {
        if (!config.apiKey) {
            throw new Error('API key is required');
        }

        this.apiKey = config.apiKey;
        this.baseURL = config.baseURL || 'https://api.deepinfra.com/v1/inference';
        this.model = config.model || 'deepseek-ai/DeepSeek-V3.2';
        this.timeout = config.timeout || 30000;
        this.conversationHistory = []; // Store conversation history
    }

    /**
     * System prompt template for the DeepSeek model
     * @type {Object}
     * @private
     */
    static #templates = {
        systemPrompt: (prompt) => `${prompt}<｜User｜>`,
        userMessage: (message) => `${message}<｜Assistant｜>`,
        assistantMessage: (message) => `${message}</think>`,
        endOfSentence: ''
    };

    /**
     * Validates and normalizes temperature parameter
     * @param {number} temp - Temperature value
     * @returns {number} Normalized temperature
     * @private
     */
    #validateTemperature(temp) {
        if (temp === undefined) return 0.7;
        if (temp < 0 || temp > 100) {
            throw new Error('Temperature must be between 0 and 100');
        }
        return temp;
    }

    /**
     * Validates top_p parameter
     * @param {number} p - Top_p value
     * @returns {number} Normalized top_p
     * @private
     */
    #validateTopP(p) {
        if (p === undefined) return 0.9;
        if (p <= 0 || p > 1) {
            throw new Error('top_p must be between 0 and 1 (exclusive of 0)');
        }
        return p;
    }

    /**
     * Validates min_p parameter
     * @param {number} p - Min_p value
     * @returns {number} Normalized min_p
     * @private
     */
    #validateMinP(p) {
        if (p === undefined) return 0;
        if (p < 0 || p > 1) {
            throw new Error('min_p must be between 0 and 1');
        }
        return p;
    }

    /**
     * Validates top_k parameter
     * @param {number} k - Top_k value
     * @returns {number} Normalized top_k
     * @private
     */
    #validateTopK(k) {
        if (k === undefined) return 0;
        if (k < 0 || k >= 1000) {
            throw new Error('top_k must be between 0 and 999');
        }
        return k;
    }

    /**
     * Validates repetition penalty
     * @param {number} penalty - Repetition penalty value
     * @returns {number} Normalized penalty
     * @private
     */
    #validateRepetitionPenalty(penalty) {
        if (penalty === undefined) return 1;
        if (penalty < 0.01 || penalty > 5) {
            throw new Error('repetition_penalty must be between 0.01 and 5');
        }
        return penalty;
    }

    /**
     * Formats messages into the required input string format
     * @param {Array<Object>|string} messages - Array of message objects or simple prompt string
     * @param {string} [systemPrompt] - Optional system prompt
     * @returns {string} Formatted input string
     */
    formatInput(messages, systemPrompt = null) {
        let input = '';

        // Add system prompt if provided
        if (systemPrompt) {
            input += DeepSeekClient.#templates.systemPrompt(systemPrompt);
        } else {
            input += '<｜User｜>';
        }

        // Handle simple string input
        if (typeof messages === 'string') {
            return input + messages + DeepSeekClient.#templates.userMessage('') + '</think>';
        }

        // Handle array of messages
        if (Array.isArray(messages)) {
            for (let i = 0; i < messages.length; i++) {
                const msg = messages[i];
                
                if (i === 0 && !systemPrompt) {
                    input = '<｜User｜>' + msg.content + '<｜Assistant｜>';
                } else {
                    switch (msg.role) {
                        case 'user':
                            input += DeepSeekClient.#templates.userMessage(msg.content);
                            break;
                        case 'assistant':
                            input += DeepSeekClient.#templates.assistantMessage(msg.content);
                            break;
                        default:
                            throw new Error(`Invalid role: ${msg.role}`);
                    }
                }
            }
            input += '</think>';
        }

        return input;
    }

    /**
     * Makes the actual HTTP request to the API
     * @param {Object} body - Request body
     * @param {boolean} stream - Whether to stream the response
     * @param {Function} [onToken] - Callback function for streaming tokens
     * @returns {Promise<Object|string>} Response data or accumulated text
     * @private
     */
    async #makeRequest(body, stream = false, onToken = null) {
        const url = `${this.baseURL}/${this.model}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API request failed: ${response.status} - ${error}`);
            }

            if (stream) {
                return this.#handleStream(response.body, onToken);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * Handles streaming response and calls the token callback
     * @param {ReadableStream} stream - The response stream
     * @param {Function} onToken - Callback function for each token
     * @returns {Promise<string>} The complete generated text
     * @private
     */
    async #handleStream(stream, onToken) {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            // Extract the token text
                            if (parsed.token && parsed.token.text) {
                                const tokenText = parsed.token.text;
                                accumulatedText += tokenText;
                                
                                // Call the callback with the token data
                                if (onToken && typeof onToken === 'function') {
                                    onToken(tokenText);
                                }
                            }
                            
                            // Handle completion
                            if (parsed.details && parsed.details.finish_reason) {
                                if (onToken && typeof onToken === 'function') {
                                    onToken(null, {
                                        isComplete: true,
                                        finishReason: parsed.details.finish_reason,
                                        numOutputTokens: parsed.num_output_tokens,
                                        numInputTokens: parsed.num_input_tokens,
                                        estimatedCost: parsed.estimated_cost
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to parse streaming data:', data);
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

        return accumulatedText;
    }

    /**
     * Generates text completion with streaming support
     * @param {Object} params - Generation parameters
     * @param {Array<Object>|string} params.messages - Messages or prompt string
     * @param {string} [params.systemPrompt] - Optional system prompt
     * @param {number} [params.max_new_tokens] - Maximum new tokens to generate
     * @param {number} [params.temperature=0.7] - Sampling temperature
     * @param {number} [params.top_p=0.9] - Top-p sampling parameter
     * @param {number} [params.min_p=0] - Minimum probability threshold
     * @param {number} [params.top_k=0] - Top-k sampling parameter
     * @param {number} [params.repetition_penalty=1] - Repetition penalty
     * @param {Array<string>} [params.stop] - Stop sequences
     * @param {number} [params.num_responses=1] - Number of responses to generate
     * @param {Object} [params.response_format] - Response format specification
     * @param {number} [params.presence_penalty=0] - Presence penalty
     * @param {number} [params.frequency_penalty=0] - Frequency penalty
     * @param {string} [params.user] - User identifier
     * @param {number} [params.seed] - Random seed
     * @param {string} [params.prompt_cache_key] - Prompt cache key
     * @param {boolean} [params.stream=false] - Whether to stream the response
     * @param {Function} [params.tokenCallback] - Callback function for streaming tokens
     * @returns {Promise<Object|string>} Completion result or accumulated text
     */
    async generate(params) {
        const {
            messages,
            systemPrompt,
            max_new_tokens,
            temperature,
            top_p,
            min_p,
            top_k,
            repetition_penalty,
            stop,
            num_responses,
            response_format,
            presence_penalty,
            frequency_penalty,
            user,
            seed,
            prompt_cache_key,
            stream = false,
            tokenCallback
        } = params;

        const input = this.formatInput(messages, systemPrompt);

        const body = {
            input,
            ...(max_new_tokens !== undefined && { max_new_tokens }),
            ...(temperature !== undefined && { temperature: this.#validateTemperature(temperature) }),
            ...(top_p !== undefined && { top_p: this.#validateTopP(top_p) }),
            ...(min_p !== undefined && { min_p: this.#validateMinP(min_p) }),
            ...(top_k !== undefined && { top_k: this.#validateTopK(top_k) }),
            ...(repetition_penalty !== undefined && { 
                repetition_penalty: this.#validateRepetitionPenalty(repetition_penalty) 
            }),
            ...(stop && { stop: stop.slice(0, 16) }), // Max 16 stop sequences
            ...(num_responses && { num_responses }),
            ...(response_format && { response_format }),
            ...(presence_penalty !== undefined && { presence_penalty }),
            ...(frequency_penalty !== undefined && { frequency_penalty }),
            ...(user && { user }),
            ...(seed !== undefined && { seed }),
            ...(prompt_cache_key && { prompt_cache_key }),
            stream: true // Always stream for this implementation
        };

        return this.#makeRequest(body, true, tokenCallback);
    }

    /**
     * Process a single message with conversation history
     * @param {string} message - User message
     * @param {Function} tokenCallback - Function to display tokens
     * @returns {Promise<string>} Complete response
     */
    async processMessage(message, tokenCallback) {
        // Add user message to history
        this.conversationHistory.push({
            role: 'user',
            content: message
        });

        let fullResponse = '';

        // Get response from API
        await this.generate({
            messages: this.conversationHistory,
            tokenCallback: (token) => {
                if (token) {
                    fullResponse += token;
                    tokenCallback(token);
                }
            }
        });

        // Add assistant response to history
        this.conversationHistory.push({
            role: 'assistant',
            content: fullResponse
        });

        return fullResponse;
    }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepSeekClient;
} else if (typeof window !== 'undefined') {
    window.DeepSeekClient = DeepSeekClient;
}

/*

// Main execution - Following your working pattern
async function main() {
    // Initialize DeepSeek client with your API key
    const client = new DeepSeekClient({ 
        apiKey: '<api_token>' 
    });

    // Create the chat instance with the processInput function (following your pattern)
    new TerminalChat(async (input, displayToken) => {
        // Check for exit commands
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
            console.log('\nGoodbye!');
            process.exit(0);
        }

        try {
            // Process the message through the client (similar to your ai.Generate call)
            await client.processMessage(input, displayToken);
        } catch (error) {
            console.error('\nError:', error.message);
        }
    }, {
        exitFunction: () => {
            console.log('\nChat ended.');
            process.exit(0);
        }
    });

    // Show initial message (this will appear after the first prompt)
    console.log('Chat started! Type "exit" or "quit" to end the conversation.\n');
}

// Run the application
main().catch(console.error);

*/