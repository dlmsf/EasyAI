import readline from 'readline';

/**
 * Represents a terminal interface that processes user prompts and displays generated content.
 */
class TerminalGenerate {
  /**
   * Creates an instance of TerminalGenerate.
   * @param {(input: string, displayToken: (token: string, color: string) => Promise<void>) => Promise<void>} generateFunction 
   *        A function that takes user input and a function to display tokens one by one, potentially in different colors.
   * @param {Object} [config] - Configuration object for the TerminalGenerate.
   * @param {Function} [config.exitFunction] - Optional function to execute on exit.
   */
  constructor(generateFunction, config = {}) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.generateFunction = generateFunction;
    this.config = config;
    this.colors = ['\x1b[34m', '\x1b[32m']; // Example colors: Blue and Green
    this.currentColorIndex = 0;
    this.initGenerate();
  }

  /**
   * Initializes the generate interface.
   */
  initGenerate() {
    this.rl.on('line', async (line) => {
      await this.processInput(line.trim());
      this.rl.prompt();
    }).on('close', () => {
      if (typeof this.config.exitFunction === 'function') {
        this.config.exitFunction();
      } else {
        console.log('Generate session ended.');
        process.exit(0);
      }
    });

    this.rl.setPrompt('Prompt: ');
    this.rl.prompt();
  }

  /**
   * Processes user input.
   * @param {string} input - The user input.
   */
  async processInput(input) {
    await this.generateFunction(input, this.displayToken.bind(this));
    process.stdout.write('\x1b[0m\n'); // Reset color and move to new line
  }

  /**
   * Displays a token.
   * @param {string} token - The token to display.
   * @param {boolean} changeColor - Whether to change the color for the next token.
   */
  async displayToken(token, changeColor = false) {
    const color = this.colors[this.currentColorIndex];
    process.stdout.write(`${color}${token}\x1b[0m`); // Print the token in the current color and reset
    if (changeColor) {
      this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length; // Cycle through colors
    }
  }
}

export default TerminalGenerate;

/*
function Sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

const teste = new TerminalGenerate(async (input,display) => {

console.log(input)

  let frase = [' Hey', ' there!', " How's", ' it', ' going?', ' I', ' was', ' just']
  
  for(const w of frase){
    await display(w)
    await Sleep(200)
  }
  
})
*/
