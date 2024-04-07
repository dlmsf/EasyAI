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
    process.stdout.write(colorCyan + 'AI:' + resetColor);
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