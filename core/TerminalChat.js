import readline from 'readline';

/**
 * Represents a chat terminal that processes user input and displays responses.
 */
class TerminalChat {
  /**
   * Creates an instance of TerminalChat.
   * @param {(input: string, displayToken: (token: string) => Promise<void>) => Promise<void>} processInputFunction 
   *        A function that takes user input and a function to display tokens one by one.
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
   * Initializes the chat interface.
   */
  initChat() {
    this.rl.on('line', async (line) => {
      await this.processInput(line.trim());
      this.rl.prompt();
    }).on('close', () => {
      if (typeof this.config.exitFunction === 'function') {
        this.config.exitFunction();
      } else {
        console.log(`
Chat ended.`);
      }
      process.exit(0);
    });

    this.rl.setPrompt('User: ');
    this.rl.prompt();
  }

  /**
   * Processes user input.
   * @param {string} input - The user input.
   */
  async processInput(input) {
    process.stdout.write('AI: ');
    await this.processInputFunction(input, this.displayToken.bind(this));
    process.stdout.write('\n');
  }

  /**
   * Displays a token.
   * @param {string} token - The token to display.
   */
  async displayToken(token) {
    process.stdout.write(token);
  }
}

export default TerminalChat