import readline from 'readline';

/**
 * Represents a chat terminal that processes user input and displays responses.
 */
class TerminalChat {
  /**
   * Creates an instance of TerminalChat.
   * @param {(input: string, displayToken: (token: string) => Promise<void>) => Promise<void>} processInputFunction 
   *        A function that takes user input and a function to display tokens one by one.
   */
  constructor(processInputFunction) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.processInputFunction = processInputFunction;
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
      console.log('Chat ended.');
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