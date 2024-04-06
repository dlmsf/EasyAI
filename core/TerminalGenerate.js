import process from 'process';

/**
 * Represents a terminal for generating output based on user input, with customizable output color.
 */
class TerminalGenerate {
  /**
   * Creates an instance of TerminalGenerate.
   * @param {(input: string, displayToken: (token: string, changeColor?: boolean) => Promise<void>) => Promise<void>} generateFunction 
   *        A function that takes user input and a function to display tokens with optional color change.
   * @param {Object} [config] - Configuration object for TerminalGenerate.
   * @param {Function} [config.exitFunction] - Optional function to execute on generator exit.
   */
  constructor(generateFunction, config = {}) {
      this.generateFunction = generateFunction;
      this.config = config;
      this.inputBuffer = '';
      this.currentColorIndex = 0; // Start with the first color
      this.colors = [
          '\x1b[31m', // Red
          '\x1b[34m'  // Blue
      ];
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      this.initGenerate();
  }

  /**
   * Initializes the generator by setting up the input listener and prompt.
   */
  initGenerate() {
      process.stdout.write('Prompt: ');
      
      process.stdin.on('data', (key) => {
          if (key === '\u000D') { // Enter key
              this.processInput(this.inputBuffer);
              this.inputBuffer = '';
          } else if (key === '\u0003') { // Ctrl+C to exit
              process.stdout.write('\x1b[0m\n'); // Reset color before exiting
              if (typeof this.config.exitFunction === 'function') {
                  this.config.exitFunction();
              } else {
                  console.log('Generate ended.');
                  process.exit();
              }
          } else {
              this.inputBuffer += key;
              process.stdout.write(key);
          }
      });
  }

  /**
   * Processes the user input, generates output, and handles color toggling.
   * @param {string} input - The user input.
   */
  async processInput(input) {
      await this.generateFunction(input, this.displayToken.bind(this));
      process.stdout.write('\x1b[0m\nPrompt: '); // Reset color and prepare for new input
  }

  /**
   * Displays a token with optional color change.
   * @param {string} token - The token to display.
   * @param {boolean} [changeColor=false] - Whether to change the color of the token.
   */
  async displayToken(token, changeColor = false) {
      if (changeColor) {
          this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length; // Toggle color index
      }
      const color = this.colors[this.currentColorIndex];
      process.stdout.write(color + token + '\x1b[0m'); // Display the token in color, then reset color
  }
}

export default TerminalGenerate