import process from 'process';

class TerminalGenerate {
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

  initGenerate() {
      process.stdout.write('Prompt: ');
      
      process.stdin.on('data', (key) => {
          if (key === '\u000D') { // Enter key
              this.processInput(this.inputBuffer);
              this.inputBuffer = '';
          } else if (key === '\u0003') { // Ctrl+C to exit
              console.log('\x1b[0m'); // Reset color before exiting
              process.exit();
          } else {
              this.inputBuffer += key;
              process.stdout.write(key);
          }
      });
  }

  async processInput(input) {
      await this.generateFunction(input, this.displayToken.bind(this));
      process.stdout.write('\x1b[0m\nPrompt: '); // Reset color and prepare for new input
  }

  async displayToken(token, changeColor = false) {
      if (changeColor) {
          this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length; // Toggle color index
      }
      const color = this.colors[this.currentColorIndex];
      process.stdout.write(color + token + '\x1b[0m'); // Display the token in color, then reset color
  }
}

export default TerminalGenerate

/*
function Sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

const teste = new TerminalGenerate(async (input,display) => {

//console.log(input)

  let frase = [' Hey', ' there!', " How's", ' it', ' going?', ' I', ' was', ' just']
  
  for(const w of frase){
    await display(w)
    await Sleep(200)
  }
  
})
*/
