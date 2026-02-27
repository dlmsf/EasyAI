#!/usr/bin/env node

import readline from 'readline';
import EventEmitter from 'events';

/**
 * Robust Terminal Chat Interface with full customization support
 * Fixed: Messages sent while bot is typing are queued and processed together after response completes
 * 
 * @class ChatHUD
 * @extends EventEmitter
 * 
 * @example
 * // Basic usage
 * const chat = new ChatHUD();
 * chat.start();
 * 
 * @example
 * // Custom configuration
 * const chat = new ChatHUD({
 *   title: 'My Custom Chat',
 *   colors: {
 *     border: '\x1b[38;5;82m',
 *     title: '\x1b[1;38;5;198m'
 *   },
 *   messageProcessor: async (message, displayToken, messageHistory) => {
 *     const response = await myAI.generate(message);
 *     for (const char of response) {
 *       displayToken(char);
 *       await sleep(50);
 *     }
 *   }
 * });
 * chat.start();
 * 
 * @example
 * // Using events
 * const chat = new ChatHUD();
 * chat.on('userMessage', (msg) => console.log('User said:', msg));
 * chat.on('botResponseStarted', (msgs) => console.log('Processing:', msgs));
 * chat.on('botResponseCompleted', (response) => console.log('Bot responded:', response));
 * chat.start();
 * 
 * @example
 * // Dynamic title update
 * const chat = new ChatHUD({ title: 'Loading...' });
 * chat.start();
 * setTimeout(() => chat.setTitle('Chat with AI'), 2000);
 */
class ChatHUD extends EventEmitter {
  /**
   * Creates a new ChatHUD instance
   * @param {Object} config - Configuration object
   * @param {string} [config.title='Terminal Chat'] - Title displayed in the header
   * @param {Function} [config.messageProcessor] - Custom message processor for bot responses
   * @param {Object} [config.colors] - Color configuration for different UI elements
   * @param {string} [config.colors.border='\x1b[38;5;39m'] - Color for borders
   * @param {string} [config.colors.title='\x1b[1;38;5;220m'] - Color for title
   * @param {string} [config.colors.user='\x1b[32m'] - Color for user label
   * @param {string} [config.colors.userText='\x1b[37m'] - Color for user message text
   * @param {string} [config.colors.bot='\x1b[36m'] - Color for bot label
   * @param {string} [config.colors.botText='\x1b[35m'] - Color for bot message text
   * @param {string} [config.colors.system='\x1b[33m'] - Color for system label
   * @param {string} [config.colors.systemText='\x1b[37m'] - Color for system message text
   * @param {string} [config.colors.timestamp='\x1b[90m'] - Color for timestamps
   * @param {string} [config.colors.prompt='\x1b[38;5;220m'] - Color for input prompt
   * @param {string} [config.colors.cursor='\x1b[48;5;220;30m'] - Color for cursor
   * @param {string} [config.colors.botIndicator='\x1b[3;90m'] - Color for typing indicator
   * @param {Object} [config.messages] - Default message templates
   * @param {string} [config.messages.welcome='🚀 Welcome to Terminal Chat!'] - Welcome message
   * @param {string} [config.messages.initialBot='Hello! How can I help you?'] - Initial bot message
   * @param {Function} [config.onInit] - Callback fired after initialization
   * @param {Function} [config.onExit] - Callback fired before exit
   * @param {Function} [config.onSigint] - Custom SIGINT handler
   */
  constructor(config = {}) {
    super();
    
    this.customSigintHandler = config.onSigint || null;

    // Configuration with defaults
    this.config = {
      messageProcessor: null,
      colors: {
        border: '\x1b[38;5;39m',
        title: '\x1b[1;38;5;220m',
        user: '\x1b[32m',          
        userText: '\x1b[37m',      
        bot: '\x1b[36m',           
        botText: '\x1b[35m',      
        system: '\x1b[33m',       
        systemText: '\x1b[37m',     
        timestamp: '\x1b[90m',
        prompt: '\x1b[38;5;220m',
        cursor: '\x1b[48;5;220;30m',
        botIndicator: '\x1b[3;90m'
      },
      messages: {
        welcome: '🚀 Welcome to Terminal Chat!',
        initialBot: 'Hello! How can I help you?',
        goodbye: '\n✨ Goodbye! ✨'
      },
      title: 'Terminal Chat',
      onInit: null,
      onExit: null,
      ...config
    };

    /** @property {Array} messages - Array of message objects in the chat history */
    this.messages = [];
    
    /** @property {string} inputLine - Current input line text */
    this.inputLine = '';
    
    /** @property {number} cursorPosition - Current cursor position in input line */
    this.cursorPosition = 0;
    
    /** @property {boolean} isBotTyping - Whether bot is currently generating a response */
    this.isBotTyping = false;
    
    /** @property {Array} messageQueue - Queue of messages waiting to be processed */
    this.messageQueue = [];
    
    /** @property {Array} pendingMessages - Messages received while bot is typing */
    this.pendingMessages = [];
    
    /** @property {boolean} isProcessing - Whether message queue is being processed */
    this.isProcessing = false;
    
    /** @property {number} width - Current terminal width in columns */
    this.width = process.stdout.columns || 80;
    
    /** @property {number} height - Current terminal height in rows */
    this.height = process.stdout.rows || 24;
    
    /** @property {readline.Interface} rl - Readline interface */
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Configure terminal
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    this.setupInputHandlers();
    
    // Initial setup
    this.clearScreen();
    this.drawFullInterface();

    if (typeof this.config.onInit === 'function') {
      this.config.onInit(this);
    }
  }
  
  /**
   * Clears the terminal screen
   * @private
   */
  clearScreen() {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
    process.stdout.write('\x1b[?25l');
  }
  
  /**
   * Redraws the complete chat interface including borders, messages, and input
   * @private
   */
  drawFullInterface() {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
    
    process.stdout.write('\x1b[0;0H');
    
    // Draw top border
    process.stdout.write(`${this.config.colors.border}┌`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┐\x1b[0m\n`);
    
    // Draw title - now using config.title
    process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    const title = ` ${this.config.title} `;
    const padding = this.width - title.length - 2;
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    process.stdout.write(' '.repeat(leftPad));
    process.stdout.write(`${this.config.colors.title}${title}\x1b[0m`);
    process.stdout.write(' '.repeat(rightPad));
    process.stdout.write(`${this.config.colors.border}│\x1b[0m\n`);
    
    // Draw separator
    process.stdout.write(`${this.config.colors.border}├`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┤\x1b[0m\n`);
    
    // Messages area
    const messageLines = this.height - 7;
    for (let i = 0; i < messageLines; i++) {
      process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
      process.stdout.write(' '.repeat(this.width - 2));
      process.stdout.write(`${this.config.colors.border}│\x1b[0m\n`);
    }
    
    // Draw separator above input
    process.stdout.write(`${this.config.colors.border}├`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┤\x1b[0m\n`);
    
    // Input line
    process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    process.stdout.write(' '.repeat(this.width - 2));
    process.stdout.write(`${this.config.colors.border}│\x1b[0m\n`);
    
    // Bottom border
    process.stdout.write(`${this.config.colors.border}└`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┘\x1b[0m`);
    
    this.redrawMessages();
    this.redrawInput();
  }

  /**
   * Updates the chat interface title dynamically
   * @param {string} newTitle - New title to display
   * @example
   * chat.setTitle('Connected to AI Assistant');
   */
  setTitle(newTitle) {
    this.config.title = newTitle;
    this.drawFullInterface();
  }
  
  /**
   * Sets up keyboard input handlers for the chat interface
   * @private
   */
  setupInputHandlers() {
    let escapeSequence = '';
    let inEscape = false;
    
    process.stdin.on('data', (chunk) => {
      const key = chunk;
      
      if (key === '\u0003') { // Ctrl+C
        this.cleanup();
        process.exit();
      }
      
      // Handle paste
      if (key.length > 1 && !inEscape) {
        this.inputLine = this.inputLine.slice(0, this.cursorPosition) + 
                        key + 
                        this.inputLine.slice(this.cursorPosition);
        this.cursorPosition += key.length;
        this.redrawInput();
        return;
      }
      
      // Handle escape sequences
      if (key === '\u001b') {
        inEscape = true;
        escapeSequence = key;
        return;
      }
      
      if (inEscape) {
        escapeSequence += key;
        if (key >= 'A' && key <= 'Z' || key === '~') {
          inEscape = false;
          if (escapeSequence === '\u001b[C' && this.cursorPosition < this.inputLine.length) {
            this.cursorPosition++;
            this.redrawInput();
          } else if (escapeSequence === '\u001b[D' && this.cursorPosition > 0) {
            this.cursorPosition--;
            this.redrawInput();
          }
        }
        return;
      }
      
      // Handle Enter
      if (key === '\r') {
        this.handleEnter();
        return;
      }
      
      // Handle Backspace
      if (key === '\b' || key === '\x7f') {
        if (this.cursorPosition > 0) {
          this.inputLine = this.inputLine.slice(0, this.cursorPosition - 1) + 
                          this.inputLine.slice(this.cursorPosition);
          this.cursorPosition--;
          this.redrawInput();
        }
        return;
      }
      
      // Regular characters
      if (key.length === 1 && !key.match(/[\x00-\x1F\x7F]/)) {
        this.inputLine = this.inputLine.slice(0, this.cursorPosition) + 
                        key + 
                        this.inputLine.slice(this.cursorPosition);
        this.cursorPosition++;
        this.redrawInput();
      }
    });
  }
  
  /**
   * Handles Enter key press - processes user input
   * @private
   */
  handleEnter() {
    if (this.inputLine.trim()) {
      const userMessage = this.inputLine;
      this.inputLine = '';
      this.cursorPosition = 0;
      
      // Always add user message to display immediately
      this.addMessage('You', userMessage, this.config.colors.user);
      
      // Emit message event
      this.emit('userMessage', userMessage);
      
      if (this.isBotTyping) {
        // If bot is typing, add to pending messages
        this.pendingMessages.push(userMessage);
      } else {
        // If bot is not typing, add to queue for processing
        this.messageQueue.push(userMessage);
        this.processQueue();
      }
      
      this.redrawInput();
    }
  }
  
  /**
   * Processes the message queue, handling bot responses
   * @private
   */
  processQueue() {
    if (this.isProcessing || this.messageQueue.length === 0 || this.isBotTyping) return;
    
    this.isProcessing = true;
    
    const processNext = async () => {
      while (this.messageQueue.length > 0 && !this.isBotTyping) {
        // Get the next message to process
        const currentMessage = this.messageQueue.shift();
        
        // Collect any pending messages that arrived while previous bot was typing
        const messagesToProcess = [currentMessage, ...this.pendingMessages];
        this.pendingMessages = []; // Clear pending messages
        
        // Generate response for all messages together
        await this.generateBotResponse(messagesToProcess);
      }
      this.isProcessing = false;
    };
    
    processNext();
  }
  
  /**
   * Generates a bot response for the given messages
   * @param {Array<string>} messages - Array of messages to respond to
   * @private
   */
  async generateBotResponse(messages) {
    this.isBotTyping = true;
    this.redrawInput();
    
    // Create the bot message container BEFORE streaming starts
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    const botMessage = {
        sender: 'Bot',
        text: '',
        timestamp,
        timestamp_raw: Date.now(),
        labelColor: this.config.colors.bot,
        textColor: this.config.colors.botText,
        lines: []
    };
    
    this.messages.push(botMessage);
    this.redrawMessages();
    
    // Use custom message processor if provided
    if (typeof this.config.messageProcessor === 'function') {
        // Pass all messages that should be processed together
        const triggerMessage = messages[messages.length - 1];
        await this.config.messageProcessor(triggerMessage, this.displayToken.bind(this), messages);
    } else {
        // Default behavior
        const response = this.getDefaultBotResponse(messages.join(' '));
        
        this.emit('botResponseStarted', messages);
        
        let currentText = '';
        for (let i = 0; i < response.length; i++) {
            currentText += response[i];
            
            // Update the LAST bot message (which should be the one we just created)
            const lastBotMessage = this.messages[this.messages.length - 1];
            if (lastBotMessage && lastBotMessage.sender === 'Bot') {
                lastBotMessage.text = currentText;
                lastBotMessage.lines = currentText.split('\n');
                lastBotMessage.labelColor = this.config.colors.bot;
                lastBotMessage.textColor = this.config.colors.botText;
            }
            
            this.redrawMessages();
            await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 40));
        }
        
        this.emit('botResponseCompleted', response);
    }
    
    this.isBotTyping = false;
    this.redrawInput();
    
    // Check if there are more messages in queue
    if (this.messageQueue.length > 0) {
        this.processQueue();
    }
  }
  
  /**
   * Displays a single token/character in the bot's response (used for streaming)
   * @param {string} token - Character or token to display
   * @private
   */
  async displayToken(token) {
    // Find the last bot message that is currently being streamed
    let lastBotMessage = null;
    
    // Look through messages from the end to find the last incomplete bot message
    for (let i = this.messages.length - 1; i >= 0; i--) {
        if (this.messages[i].sender === 'Bot') {
            lastBotMessage = this.messages[i];
            break;
        }
    }
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    // If no bot message exists or the last bot message is complete (has a period at the end or is older than 2 seconds), create new one
    const now = Date.now();
    const messageAge = lastBotMessage ? now - (lastBotMessage.timestamp_raw || 0) : Infinity;
    
    if (!lastBotMessage || messageAge > 2000) { // If message is older than 2 seconds, it's probably complete
        // Create new bot message
        const newMessage = {
            sender: 'Bot',
            text: token,
            timestamp,
            timestamp_raw: now,
            labelColor: this.config.colors.bot,
            textColor: this.config.colors.botText,
            lines: token.split('\n')
        };
        this.messages.push(newMessage);
    } else {
        // Append to existing bot message
        lastBotMessage.text += token;
        lastBotMessage.timestamp_raw = now; // Update timestamp
        if (!lastBotMessage.labelColor) {
            lastBotMessage.labelColor = this.config.colors.bot;
        }
        if (!lastBotMessage.textColor) {
            lastBotMessage.textColor = this.config.colors.botText;
        }
        lastBotMessage.lines = lastBotMessage.text.split('\n');
    }
    
    this.redrawMessages();
  }
  
  /**
   * Returns a default bot response based on the input message
   * @param {string} message - User message to respond to
   * @returns {string} Bot response
   * @private
   */
  getDefaultBotResponse(message) {
    const lowerMsg = message.toLowerCase();
    const responses = {
      greeting: ['Hello!', 'Hi there!', 'Hey!', 'Greetings!'],
      question: ['Interesting question...', 'Let me think...', 'Good question!'],
      bye: ['Goodbye!', 'See you later!', 'Take care!'],
      default: ['Nice!', 'Cool!', 'Awesome!', 'Got it!', 'Interesting!']
    };
    
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return responses.greeting[Math.floor(Math.random() * responses.greeting.length)];
    } else if (lowerMsg.includes('?')) {
      return responses.question[Math.floor(Math.random() * responses.question.length)];
    } else if (lowerMsg.includes('bye')) {
      return responses.bye[Math.floor(Math.random() * responses.bye.length)];
    } else {
      return responses.default[Math.floor(Math.random() * responses.default.length)];
    }
  }
  
  /**
   * Adds a message to the chat display
   * @param {string} sender - Message sender ('You', 'Bot', or system name)
   * @param {string} text - Message content
   * @param {string} [color] - Color code for the message (optional)
   * @public
   */
  addMessage(sender, text, color) {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    let labelColor, textColor;
    if (sender === 'Bot') {
      labelColor = this.config.colors.bot;
      textColor = this.config.colors.botText;
    } else if (sender === 'You') {
      labelColor = this.config.colors.user;
      textColor = this.config.colors.userText;
    } else {
      labelColor = this.config.colors.system;
      textColor = this.config.colors.systemText;
    }
    
    this.messages.push({ 
      sender, 
      text, 
      timestamp, 
      labelColor,
      textColor,
      lines: text.split('\n')
    });
    this.redrawMessages();
  }
  
  /**
   * Redraws the messages area of the interface
   * @private
   */
  redrawMessages() {
    const messageStartLine = 3;
    const messageLines = this.height - 7;
    
    const displayLines = [];
    
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      const msgLines = msg.lines || msg.text.split('\n');
      
      const labelColor = msg.labelColor || 
        (msg.sender === 'Bot' ? this.config.colors.bot : 
         msg.sender === 'You' ? this.config.colors.user : 
         this.config.colors.system);
      
      const textColor = msg.textColor || 
        (msg.sender === 'Bot' ? this.config.colors.botText : 
         msg.sender === 'You' ? this.config.colors.userText : 
         this.config.colors.systemText) || '\x1b[37m';
      
      const prefix = `[${msg.timestamp}] ${msg.sender}: `;
      const prefixLength = this.stripAnsi(prefix).length;
      const firstLineAvailable = this.width - prefixLength - 4;
      const continuationIndent = ' '.repeat(prefixLength - 1);
      const continuationAvailable = this.width - continuationIndent.length - 4;
      
      for (let j = 0; j < msgLines.length; j++) {
        const line = msgLines[j];
        
        if (j === 0) {
          const coloredPrefix = `${this.config.colors.timestamp}[${msg.timestamp}]\x1b[0m ${labelColor}${msg.sender}:\x1b[0m `;
          
          const wrappedLines = this.wrapText(line, firstLineAvailable);
          
          for (let k = 0; k < wrappedLines.length; k++) {
            if (k === 0) {
              displayLines.push({
                prefix: coloredPrefix,
                text: wrappedLines[k],
                textColor: textColor,
                isFirstOfMessage: true
              });
            } else {
              displayLines.push({
                prefix: continuationIndent,
                text: wrappedLines[k],
                textColor: textColor,
                isContinuation: true
              });
            }
          }
        } else {
          const wrappedLines = this.wrapText(line, continuationAvailable);
          
          for (const wrappedLine of wrappedLines) {
            displayLines.push({
              prefix: continuationIndent,
              text: wrappedLine,
              textColor: textColor,
              isContinuation: true
            });
          }
        }
      }
    }
    
    const startIndex = Math.max(0, displayLines.length - messageLines);
    
    for (let i = 0; i < messageLines; i++) {
      process.stdout.write(`\x1b[${messageStartLine + i};0H`);
      process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
      
      if (startIndex + i < displayLines.length) {
        const line = displayLines[startIndex + i];
        process.stdout.write(line.prefix);
        
        if (line.textColor) {
          process.stdout.write(`${line.textColor}${line.text}\x1b[0m`);
        } else {
          process.stdout.write(line.text);
        }
        
        const contentLength = this.stripAnsi(line.prefix + line.text).length;
        const fillLength = this.width - contentLength - 2;
        
        if (fillLength > 0) {
          process.stdout.write(' '.repeat(fillLength));
        }
      } else {
        process.stdout.write(' '.repeat(this.width - 2));
      }
      
      process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    }
    
    this.redrawBottomArea();
  }

  /**
   * Removes ANSI color codes from a string
   * @param {string} str - String with ANSI codes
   * @returns {string} Clean string without ANSI codes
   * @private
   */
  stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Wraps text to fit within a specified width
   * @param {string} text - Text to wrap
   * @param {number} maxWidth - Maximum width per line
   * @returns {Array<string>} Array of wrapped lines
   * @private
   */
  wrapText(text, maxWidth) {
    if (text.length <= maxWidth) return [text];
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        
        if (word.length > maxWidth) {
          let remainingWord = word;
          while (remainingWord.length > maxWidth) {
            lines.push(remainingWord.substring(0, maxWidth - 1) + '-');
            remainingWord = remainingWord.substring(maxWidth - 1);
          }
          currentLine = remainingWord;
        } else {
          currentLine = word;
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }
  
  /**
   * Redraws the bottom area of the interface including input line
   * @private
   */
  redrawBottomArea() {
    const separatorLine = this.height - 3;
    const inputLine = this.height - 2;
    const bottomLine = this.height - 1;
    
    process.stdout.write(`\x1b[s`);
    
    process.stdout.write(`\x1b[${separatorLine};0H`);
    process.stdout.write(`${this.config.colors.border}├`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┤\x1b[0m`);
    
    this.redrawInput();
    
    process.stdout.write(`\x1b[${bottomLine};0H`);
    process.stdout.write(`${this.config.colors.border}└`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┘\x1b[0m`);
    
    process.stdout.write(`\x1b[u`);
  }
  
  /**
   * Redraws the input line with current text and cursor
   * @private
   */
  redrawInput() {
    const inputLine = this.height - 2;
    
    process.stdout.write(`\x1b[${inputLine};0H`);
    process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    process.stdout.write(` ${this.config.colors.prompt}➤\x1b[0m `);
    
    const availableWidth = this.width - 5;
    
    let displayInput = this.inputLine;
    let cursorPos = this.cursorPosition;
    
    if (displayInput.length > availableWidth) {
      const offset = displayInput.length - availableWidth;
      displayInput = '…' + displayInput.substring(offset + 1);
      cursorPos = Math.max(0, this.cursorPosition - offset - 1);
    }
    
    const beforeCursor = displayInput.slice(0, cursorPos);
    const cursorChar = displayInput[cursorPos] || ' ';
    const afterCursor = displayInput.slice(cursorPos + 1);
    
    const usedWidth = beforeCursor.length + afterCursor.length + 1;
    const remainingSpace = availableWidth - usedWidth;
    
    process.stdout.write(beforeCursor);
    
    if (Date.now() % 1200 < 600) {
      process.stdout.write(`${this.config.colors.cursor}${cursorChar}\x1b[0m`);
    } else {
      process.stdout.write(cursorChar);
    }
    
    process.stdout.write(afterCursor);
    
    if (remainingSpace > 0) {
      if (this.isBotTyping && remainingSpace >= 5) {
        const spaces = remainingSpace - 5;
        if (spaces > 0) process.stdout.write(' '.repeat(spaces));
        process.stdout.write(`${this.config.colors.botIndicator}[bot]\x1b[0m`);
      } else {
        process.stdout.write(' '.repeat(remainingSpace));
      }
    }
    
    process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    
    const bottomLine = this.height - 1;
    process.stdout.write(`\x1b[${bottomLine};0H`);
    process.stdout.write(`${this.config.colors.border}└`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┘\x1b[0m`);
    
    const cursorX = 3 + cursorPos;
    process.stdout.write(`\x1b[${inputLine};${cursorX}H`);
  }
  
  /**
   * Cleans up terminal settings before exit
   * @public
   */
  cleanup() {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[0;0H');
    process.stdout.write('\x1b[?25h');
    process.stdout.write('\x1b[0m');
    process.stdin.setRawMode(false);
    this.rl.close();
    
    process.removeAllListeners('SIGINT');
    
    if (typeof this.config.onExit === 'function') {
      setTimeout(() => {
        this.config.onExit(this);
      }, 0);
    }
    
    if (activeChatInstance === this) {
      activeChatInstance = null;
    }
  }
  
  /**
   * Starts the chat interface
   * @public
   * @fires ChatHUD#started
   */
  start() {
    activeChatInstance = this;
    
    process.stdout.on('resize', () => {
      this.width = process.stdout.columns || 80;
      this.height = process.stdout.rows || 24;
      this.drawFullInterface();
    });
    
    setInterval(() => this.redrawInput(), 600);
    
    /**
     * Started event - fired when chat interface starts
     * @event ChatHUD#started
     */
    this.emit('started');
  }
  
  /**
   * Sends a message to be displayed in the chat
   * @param {string} sender - Message sender
   * @param {string} message - Message content
   * @param {string} [color='\x1b[36m'] - Color for the message
   * @public
   */
  sendMessage(sender, message, color = '\x1b[36m') {
    this.addMessage(sender, message, color);
  }
  
  /**
   * Simulates a bot typing response (for testing)
   * @param {string} response - Response to simulate
   * @public
   */
  async simulateBotResponse(response) {
    this.isBotTyping = true;
    this.redrawInput();
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    const msgIndex = this.messages.length;
    this.messages.push({
      sender: 'Bot',
      text: '',
      timestamp,
      color: this.config.colors.bot,
      lines: []
    });
    
    let currentText = '';
    for (let i = 0; i < response.length; i++) {
      currentText += response[i];
      this.messages[msgIndex].text = currentText;
      this.messages[msgIndex].lines = currentText.split('\n');
      this.redrawMessages();
      await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 40));
    }
    
    this.isBotTyping = false;
    this.redrawInput();
  }
}

/** @type {ChatHUD|null} - Currently active chat instance */
let activeChatInstance = null;

/**
 * Global SIGINT (Ctrl+C) handler
 * @private
 */
process.on('SIGINT', () => {
  if (activeChatInstance) {
    activeChatInstance.cleanup();
    activeChatInstance = null;
  } else {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[0;0H');
    process.stdout.write('\x1b[?25h');
    process.stdout.write('\x1b[0m');
    process.stdin.setRawMode(false);
    process.exit();
  }
});

/**
 * Self-executing code when run directly
 * @private
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const chat = new ChatHUD();
  chat.start();
}

export default ChatHUD;