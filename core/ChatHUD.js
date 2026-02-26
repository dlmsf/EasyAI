#!/usr/bin/env node

import readline from 'readline';
import EventEmitter from 'events';

/**
 * Robust Terminal Chat Interface with full customization support
 * Preserves all original functionality including rapid message handling
 * Added proper line break support for bot responses
 */
class ChatHUD extends EventEmitter {
  /**
   * Create a new ChatHUD instance
   * @param {Object} config - Configuration object for customizing the chat
   * @param {Function} [config.messageProcessor] - Async function to process user messages and return bot responses
   * @param {Object} [config.colors] - Custom color mappings
   * @param {Function} [config.onInit] - Called when chat initializes
   * @param {Function} [config.onExit] - Called when chat exits
   * @param {Object} [config.messages] - Custom welcome messages
   */
  constructor(config = {}) {
    super();
    
    // Configuration with defaults
    this.config = {
      messageProcessor: null,
      colors: {
        border: '\x1b[38;5;39m',
        title: '\x1b[1;38;5;220m',
        user: '\x1b[32m',
        bot: '\x1b[35m',
        system: '\x1b[33m',
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
      onInit: null,
      onExit: null,
      ...config
    };

    this.messages = [];
    this.inputLine = '';
    this.cursorPosition = 0;
    this.isBotTyping = false;
    this.botResponseQueue = [];
    this.isProcessingBotQueue = false;
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
    
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

    // Call onInit callback if provided
    if (typeof this.config.onInit === 'function') {
      this.config.onInit(this);
    }
  }
  
  clearScreen() {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
    process.stdout.write('\x1b[?25l'); // Hide cursor
  }
  
  drawFullInterface() {
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
    
    // Clear everything and start from top
    process.stdout.write('\x1b[0;0H');
    
    // Draw top border
    process.stdout.write(`${this.config.colors.border}┌`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┐\x1b[0m\n`);
    
    // Draw title
    process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    const title = ' ROBUST TERMINAL CHAT ';
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
    
    // Messages area (filled dynamically)
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
    
    // Input line (will be filled by redrawInput)
    process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    process.stdout.write(' '.repeat(this.width - 2));
    process.stdout.write(`${this.config.colors.border}│\x1b[0m\n`);
    
    // Bottom border
    process.stdout.write(`${this.config.colors.border}└`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┘\x1b[0m`);
    
    // Now fill with actual content
    this.redrawMessages();
    this.redrawInput();
  }
  
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
  
  handleEnter() {
    if (this.inputLine.trim()) {
      const userMessage = this.inputLine;
      this.inputLine = '';
      this.cursorPosition = 0;
      this.addMessage('You', userMessage, this.config.colors.user);
      
      // Emit message event
      this.emit('userMessage', userMessage);
      
      this.botResponseQueue.push(userMessage);
      this.processBotQueue();
    }
    this.redrawInput();
  }
  
  processBotQueue() {
    if (this.isProcessingBotQueue || this.botResponseQueue.length === 0) return;
    this.isProcessingBotQueue = true;
    
    const processNext = async () => {
      while (this.botResponseQueue.length > 0) {
        const message = this.botResponseQueue.shift();
        await this.generateBotResponse(message);
      }
      this.isProcessingBotQueue = false;
    };
    
    processNext();
  }
  
  async generateBotResponse(userMessage) {
    this.isBotTyping = true;
    this.redrawInput();
    
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));
    
    // Use custom message processor if provided
    if (typeof this.config.messageProcessor === 'function') {
        // Custom processor handles streaming via displayToken
        // We don't need to create a new message here because displayToken handles it
        await this.config.messageProcessor(userMessage, this.displayToken.bind(this));
        // IMPORTANT: Don't do anything else - the processor handles everything
    } else {
        // Default behavior when no custom processor
        const response = this.getDefaultBotResponse(userMessage);
        
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
        
        // Emit bot response started
        this.emit('botResponseStarted', userMessage);
        
        let currentText = '';
        for (let i = 0; i < response.length; i++) {
            currentText += response[i];
            this.messages[msgIndex].text = currentText;
            this.messages[msgIndex].lines = currentText.split('\n');
            this.redrawMessages();
            await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 40));
        }
        
        // Emit bot response completed
        this.emit('botResponseCompleted', response);
    }
    
    this.isBotTyping = false;
    this.redrawInput();
}

// Helper method to wrap text without breaking words
wrapText(text, maxWidth) {
    if (text.length <= maxWidth) return [text];
    
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        // Check if adding this word would exceed the limit
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        
        if (testLine.length <= maxWidth) {
            currentLine = testLine;
        } else {
            // If current line is not empty, push it
            if (currentLine) {
                lines.push(currentLine);
            }
            
            // If the word itself is longer than maxWidth, we need to hyphenate
            if (word.length > maxWidth) {
                // Split the long word
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
    
    // Push the last line
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}
  
  /**
 * Display a token during streaming response
 * @param {string} token - Token to display
 */
  async displayToken(token) {
    // Get the last message
    let lastMessage = this.messages[this.messages.length - 1];
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    // If no last message or last message is not from bot, create new bot message
    if (!lastMessage || lastMessage.sender !== 'Bot') {
        this.messages.push({
            sender: 'Bot',
            text: token,
            timestamp,
            color: this.config.colors.bot
        });
    } else {
        // Append to existing bot message
        lastMessage.text += token;
    }
    
    // Update lines after text change
    if (lastMessage) {
        lastMessage.lines = lastMessage.text.split('\n');
    }
    
    this.redrawMessages();
}
  
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
  
  addMessage(sender, text, color) {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    this.messages.push({ 
        sender, 
        text, 
        timestamp, 
        color,
        lines: text.split('\n')
    });
    this.redrawMessages();
}
  
redrawMessages() {
    const messageStartLine = 3; // After top border, title, separator
    const messageLines = this.height - 7; // Leave space for separator, input, and bottom border
    
    // Build display lines with proper wrapping
    const displayLines = [];
    
    // Process messages from oldest to newest for display
    for (let i = 0; i < this.messages.length; i++) {
        const msg = this.messages[i];
        const msgLines = msg.lines || msg.text.split('\n');
        
        // Calculate prefix for first line
        const prefix = `[${msg.timestamp}] ${msg.sender}: `;
        const prefixLength = this.stripAnsi(prefix).length;
        const firstLineAvailable = this.width - prefixLength - 4;
        const continuationIndent = ' '.repeat(prefixLength - 1);
        const continuationAvailable = this.width - continuationIndent.length - 4;
        
        for (let j = 0; j < msgLines.length; j++) {
            const line = msgLines[j];
            
            if (j === 0) {
                // First line includes prefix
                const coloredPrefix = `${this.config.colors.timestamp}[${msg.timestamp}]\x1b[0m ${msg.color}${msg.sender}:\x1b[0m `;
                
                // Wrap the first line with word awareness
                const wrappedLines = this.wrapText(line, firstLineAvailable);
                
                for (let k = 0; k < wrappedLines.length; k++) {
                    if (k === 0) {
                        // First part of first line with prefix
                        displayLines.push({
                            prefix: coloredPrefix,
                            text: wrappedLines[k],
                            isFirstOfMessage: true
                        });
                    } else {
                        // Continuation of first line (indented)
                        displayLines.push({
                            prefix: continuationIndent,
                            text: wrappedLines[k],
                            isContinuation: true
                        });
                    }
                }
            } else {
                // Subsequent lines of multi-line message (no prefix)
                // Wrap with word awareness
                const wrappedLines = this.wrapText(line, continuationAvailable);
                
                for (const wrappedLine of wrappedLines) {
                    displayLines.push({
                        prefix: continuationIndent,
                        text: wrappedLine,
                        isContinuation: true
                    });
                }
            }
        }
    }
    
    // Calculate which lines to show (show newest at bottom)
    const startIndex = Math.max(0, displayLines.length - messageLines);
    
    // Draw messages
    for (let i = 0; i < messageLines; i++) {
        // Position cursor
        process.stdout.write(`\x1b[${messageStartLine + i};0H`);
        
        // Draw left border
        process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
        
        if (startIndex + i < displayLines.length) {
            const line = displayLines[startIndex + i];
            
            // Write prefix (with colors)
            process.stdout.write(line.prefix);
            
            // Write text
            process.stdout.write(line.text);
            
            // Calculate fill to right border
            const contentLength = this.stripAnsi(line.prefix + line.text).length;
            const fillLength = this.width - contentLength - 2;
            
            if (fillLength > 0) {
                process.stdout.write(' '.repeat(fillLength));
            }
        } else {
            // Empty line
            process.stdout.write(' '.repeat(this.width - 2));
        }
        
        // Draw right border
        process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    }
    
    this.redrawBottomArea();
}

// Helper method to strip ANSI color codes for length calculation
stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, '');
}
  
  redrawBottomArea() {
    const separatorLine = this.height - 3;
    const inputLine = this.height - 2;
    const bottomLine = this.height - 1;
    
    // Save cursor position
    process.stdout.write(`\x1b[s`);
    
    // Redraw separator line
    process.stdout.write(`\x1b[${separatorLine};0H`);
    process.stdout.write(`${this.config.colors.border}├`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┤\x1b[0m`);
    
    // Redraw input line
    this.redrawInput();
    
    // Redraw bottom border
    process.stdout.write(`\x1b[${bottomLine};0H`);
    process.stdout.write(`${this.config.colors.border}└`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┘\x1b[0m`);
    
    // Restore cursor position
    process.stdout.write(`\x1b[u`);
  }
  
  redrawInput() {
    const inputLine = this.height - 2;
    
    // Position cursor at input line
    process.stdout.write(`\x1b[${inputLine};0H`);
    
    // Draw left border
    process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    
    // Input prompt
    process.stdout.write(` ${this.config.colors.prompt}➤\x1b[0m `);
    
    // Available width for input
    const availableWidth = this.width - 5; // border(1) + space(1) + prompt(2) + border(1) = 5
    
    // Prepare display text
    let displayInput = this.inputLine;
    let cursorPos = this.cursorPosition;
    
    if (displayInput.length > availableWidth) {
      const offset = displayInput.length - availableWidth;
      displayInput = '…' + displayInput.substring(offset + 1);
      cursorPos = Math.max(0, this.cursorPosition - offset - 1);
    }
    
    // Split input into parts
    const beforeCursor = displayInput.slice(0, cursorPos);
    const cursorChar = displayInput[cursorPos] || ' ';
    const afterCursor = displayInput.slice(cursorPos + 1);
    
    // Calculate used width
    const usedWidth = beforeCursor.length + afterCursor.length + 1;
    const remainingSpace = availableWidth - usedWidth;
    
    // Write input with cursor
    process.stdout.write(beforeCursor);
    
    // Blinking cursor
    if (Date.now() % 1200 < 600) {
      process.stdout.write(`${this.config.colors.cursor}${cursorChar}\x1b[0m`);
    } else {
      process.stdout.write(cursorChar);
    }
    
    process.stdout.write(afterCursor);
    
    // Fill remaining space and show bot indicator if needed
    if (remainingSpace > 0) {
      if (this.isBotTyping && remainingSpace >= 5) {
        // Show bot indicator on the right
        const spaces = remainingSpace - 5; // "[bot]" is 5 chars
        if (spaces > 0) process.stdout.write(' '.repeat(spaces));
        process.stdout.write(`${this.config.colors.botIndicator}[bot]\x1b[0m`);
      } else {
        process.stdout.write(' '.repeat(remainingSpace));
      }
    }
    
    // Draw right border
    process.stdout.write(`${this.config.colors.border}│\x1b[0m`);
    
    // Ensure bottom border is redrawn after input
    const bottomLine = this.height - 1;
    process.stdout.write(`\x1b[${bottomLine};0H`);
    process.stdout.write(`${this.config.colors.border}└`);
    for (let i = 0; i < this.width - 2; i++) process.stdout.write('─');
    process.stdout.write(`┘\x1b[0m`);
    
    // Position cursor for typing
    const cursorX = 3 + cursorPos; // border(1) + space(1) + prompt(1) = 3
    process.stdout.write(`\x1b[${inputLine};${cursorX}H`);
  }
  
  cleanup() {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[0;0H');
    process.stdout.write('\x1b[?25h');
    process.stdout.write('\x1b[0m');
    process.stdin.setRawMode(false);
    this.rl.close();
    
    // Remove all listeners to prevent memory leaks
    process.removeAllListeners('SIGINT');
    
    // Call onExit callback if provided
    if (typeof this.config.onExit === 'function') {
        // Use setTimeout to break the call stack
        setTimeout(() => {
            this.config.onExit(this);
        }, 0);
    }
}
  
  start() {
    activeChatInstance = this;
    //this.addMessage('System', this.config.messages.welcome, this.config.colors.system);
    //this.addMessage('Bot', this.config.messages.initialBot, this.config.colors.bot);
    
    process.stdout.on('resize', () => {
      this.width = process.stdout.columns || 80;
      this.height = process.stdout.rows || 24;
      this.drawFullInterface();
    });
    
    setInterval(() => this.redrawInput(), 600);
    
    // Emit start event
    this.emit('started');
  }
  
  /**
   * Send a message programmatically
   * @param {string} sender - Sender name
   * @param {string} message - Message text
   * @param {string} color - Color code (optional)
   */
  sendMessage(sender, message, color = '\x1b[36m') {
    this.addMessage(sender, message, color);
  }
  
  /**
   * Simulate bot typing and response
   * @param {string} response - Response text to stream
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

// Remove the global SIGINT handler and replace with this
let activeChatInstance = null;

// Handle SIGINT globally
process.on('SIGINT', () => {
    if (activeChatInstance) {
        activeChatInstance.cleanup();
        activeChatInstance = null;
    } else {
        process.stdout.write('\x1b[2J\x1b[3J\x1b[0;0H');
        process.stdout.write('\x1b[?25h');
        process.stdout.write('\x1b[0m');
        process.stdin.setRawMode(false);
        console.log('\n✨ Goodbye! ✨');
        process.exit();
    }
});

// If script is executed directly (not imported), run with default configuration
if (import.meta.url === `file://${process.argv[1]}`) {
  const chat = new ChatHUD();
  chat.start();
}

export default ChatHUD;