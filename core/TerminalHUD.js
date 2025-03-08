import readline from 'readline';
import { stdin, stdout } from 'process';

/**
 * TerminalHUD class
 */
class TerminalHUD {
  /**
   * Constructor
   * @param {object} config - Optional configuration
   * @param {boolean} config.arrowNavigation - If true, force arrow key navigation; if false, use traditional numbered menus (default: false)
   * @param {string} config.highlightColor - Optional color name for highlighting the selected menu option (default: blue)
   */
  constructor(config = {}) {
    this.rl = readline.createInterface({
      input: stdin,
      output: stdout
    });
    this.loading = false;
    // Single option to choose navigation mode.
    this.arrowNavigation = config.arrowNavigation || false;
    // Use provided highlightColor or default to blue.
    this.highlightColor = this.getAnsiBackgroundColor(config.highlightColor || 'blue');

    // For preserving menu selection between reloads of the same menu
    this.lastMenuGenerator = null;
    this.lastSelectedIndex = 0;
  }

  /**
   * Get ANSI background color code for highlighting
   * @param {string} color - The color name
   * @returns {string} - ANSI escape sequence or empty string if invalid
   */
  getAnsiBackgroundColor(color) {
    const colors = {
      red: '\x1b[41m',
      green: '\x1b[42m',
      yellow: '\x1b[43m',
      blue: '\x1b[44m',
      magenta: '\x1b[45m',
      cyan: '\x1b[46m',
      white: '\x1b[47m'
    };
    return colors[color] || '';
  }

  /**
   * Reset ANSI color
   */
  resetColor() {
    return '\x1b[0m';
  }

  /**
   * Start loading animation
   */
  startLoading() {
    this.loading = true;
    let i = 0;
    this.loadingInterval = setInterval(() => {
      stdout.clearLine();
      stdout.cursorTo(0);
      stdout.write(`⏳ Loading${'.'.repeat(i)}`);
      i = (i + 1) % 4;
    }, 500);
  }

  /**
   * Stop loading animation
   */
  stopLoading() {
    this.loading = false;
    clearInterval(this.loadingInterval);
    stdout.clearLine();
    stdout.cursorTo(0);
  }

  /**
   * Ask a question to the user
   * @param {string} question - The question to ask
   * @param {object} config - Optional configuration
   * @returns {Promise<string>} - The user's answer
   */
  async ask(question, config = {}) {
    if (config.options) {
      if (this.arrowNavigation) {
        return this.displayMenuWithArrows(question, config.options, config, 0);
      } else {
        return this.displayMenuFromOptions(question, config.options, config);
      }
    } else {
      return new Promise(resolve => {
        this.rl.question(`\n${question}`, answer => {
          resolve(answer);
        });
      });
    }
  }

  /**
   * Display a traditional numbered menu from options.
   * Always clears the screen so that previous logs or menus do not remain.
   * @param {string} question - The question to ask
   * @param {array} options - The options to display (supports same-line arrays)
   * @param {object} config - Optional configuration (default clear is now true)
   * @returns {Promise<string|void>} - The user's choice or void if an action is executed
   */
  async displayMenuFromOptions(question, options, config = { clear: true }) {
    console.clear();
    if (question) {
      console.log(`${question}\n`);
    }
    let optionIndex = 1;
    const optionMap = {};
    for (let index = 0; index < options.length; index++) {
      const option = options[index];
      if (Array.isArray(option)) {
        let line = '';
        for (let subIndex = 0; subIndex < option.length; subIndex++) {
          const subOption = option[subIndex];
          if (typeof subOption === 'string') {
            line += `${optionIndex}. ${subOption} `;
            optionMap[optionIndex] = subOption;
            optionIndex++;
          } else {
            line += `${optionIndex}. ${subOption.name} `;
            optionMap[optionIndex] = subOption;
            optionIndex++;
          }
        }
        console.log(line.trim());
      } else if (typeof option === 'string') {
        console.log(`${optionIndex}. ${option}`);
        optionMap[optionIndex] = option;
        optionIndex++;
      } else {
        console.log(`${optionIndex}. ${option.name}`);
        optionMap[optionIndex] = option;
        optionIndex++;
      }
    }
    const choice = parseInt(await this.ask('Choose an option: '));
    const chosenOption = optionMap[choice];
    if (chosenOption) {
      if (typeof chosenOption === 'string') {
        return chosenOption;
      } else if (chosenOption.action) {
        await chosenOption.action();
      } else {
        return chosenOption.name;
      }
    } else {
      console.log('Invalid option, try again.');
      return this.displayMenuFromOptions(question, options, config);
    }
  }

  /**
   * Normalize options into a two-dimensional array (lines) to support multi-option lines.
   * @param {array} options - The options in the original format.
   * @returns {array} - Array of lines, each line being an array of option objects.
   */
  normalizeOptions(options) {
    const lines = [];
    for (let opt of options) {
      if (Array.isArray(opt)) {
        const line = opt.map(item => (typeof item === 'string' ? { name: item } : item));
        lines.push(line);
      } else if (typeof opt === 'object' && opt.type === 'options' && Array.isArray(opt.value)) {
        const line = opt.value.map(item => (typeof item === 'string' ? { name: item } : item));
        lines.push(line);
      } else {
        lines.push([typeof opt === 'string' ? { name: opt } : opt]);
      }
    }
    return lines;
  }

  /**
   * Convert a linear index into coordinates {line, col} within the normalized options.
   * @param {array} lines - The normalized options array.
   * @param {number} index - The linear index.
   * @returns {object} - Object with properties "line" and "col".
   */
  getCoordinatesFromLinearIndex(lines, index) {
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      if (index < count + lines[i].length) {
        return { line: i, col: index - count };
      }
      count += lines[i].length;
    }
    const lastLine = lines.length - 1;
    return { line: lastLine, col: lines[lastLine].length - 1 };
  }

  /**
   * Convert coordinates {line, col} into a linear index.
   * @param {array} lines - The normalized options array.
   * @param {number} line - The line index.
   * @param {number} col - The column index.
   * @returns {number} - The corresponding linear index.
   */
  getLinearIndexFromCoordinates(lines, line, col) {
    let count = 0;
    for (let i = 0; i < line; i++) {
      count += lines[i].length;
    }
    return count + col;
  }

  /**
   * Display a menu using arrow key navigation.
   * Supports multi-option lines and preserves the selected option when reloading the same menu.
   * @param {string} question - The question or menu title.
   * @param {array} options - The options to display (in the same format as the first version).
   * @param {object} config - Optional configuration
   * @param {number} initialSelectedIndex - The linear index of the initially selected option.
   * @returns {Promise<string|void>} - The user's choice or void if an action is executed.
   */
  async displayMenuWithArrows(question, options = [], config = { clear: false }, initialSelectedIndex = 0) {
    return new Promise(resolve => {
      if (config.clear) console.clear();
      if (question) {
        console.clear();
        console.log(`${question}\n`);
      }
      const lines = this.normalizeOptions(options);
      let { line: selectedLine, col: selectedCol } = this.getCoordinatesFromLinearIndex(lines, initialSelectedIndex);

      const getOptionText = option => {
        if (typeof option === 'string') return option;
        if (typeof option === 'object') {
          return option.name ? option.name : JSON.stringify(option);
        }
        return String(option);
      };

      const renderMenu = () => {
        console.clear();
        if (question) {
          console.log(`${question}\n`);
        }
        for (let i = 0; i < lines.length; i++) {
          let lineStr = '';
          for (let j = 0; j < lines[i].length; j++) {
            const option = lines[i][j];
            const isSelected = i === selectedLine && j === selectedCol;
            let text = getOptionText(option);
            if (isSelected) {
              if (this.highlightColor) {
                text = `${this.highlightColor}${text}${this.resetColor()}`;
              } else {
                text = `→ ${text}`;
              }
            }
            lineStr += text + '   ';
          }
          console.log(lineStr.trim());
        }
      };

      const onKeyPress = async (chunk, key) => {
        if (key.name === 'up') {
          if (selectedLine > 0) {
            selectedLine--;
            if (selectedCol >= lines[selectedLine].length) {
              selectedCol = lines[selectedLine].length - 1;
            }
          }
        } else if (key.name === 'down') {
          if (selectedLine < lines.length - 1) {
            selectedLine++;
            if (selectedCol >= lines[selectedLine].length) {
              selectedCol = lines[selectedLine].length - 1;
            }
          }
        } else if (key.name === 'left') {
          if (selectedCol > 0) {
            selectedCol--;
          }
        } else if (key.name === 'right') {
          if (selectedCol < lines[selectedLine].length - 1) {
            selectedCol++;
          }
        } else if (key.name === 'return') {
          stdin.removeListener('keypress', onKeyPress);
          stdin.setRawMode(false);
          this.lastSelectedIndex = this.getLinearIndexFromCoordinates(lines, selectedLine, selectedCol);
          const chosenOption = lines[selectedLine][selectedCol];
          if (chosenOption && chosenOption.action) {
            await chosenOption.action();
            resolve();
          } else {
            resolve(chosenOption.name || getOptionText(chosenOption));
          }
          return;
        }
        renderMenu();
      };

      readline.emitKeypressEvents(stdin);
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('keypress', onKeyPress);
      renderMenu();
    });
  }

  /**
   * Display a menu generated by a menuGenerator function.
   * Retains original props and supports both arrow and traditional numbered modes.
   * Also preserves the selected option if the same menu is reloaded.
   * @param {function} menuGenerator - A function that generates the menu.
   * @param {object} config - Optional configuration
   * @returns {Promise<void>}
   */
  async displayMenu(menuGenerator, config = { props: {}, clearScreen: true, alert: undefined, alert_emoji: '⚠️', initialSelectedIndex: 0 }) {
    if (config.clearScreen) console.clear();
    this.startLoading();
    const menu = await menuGenerator(config.props);
    this.stopLoading();

    if (config.alert) {
      console.log(`${config.alert_emoji || '⚠️'}  ${config.alert}\n`);
    }
    const menuTitle = await menu.title;
    if (this.arrowNavigation) {
      const initialIndex = (menuGenerator === this.lastMenuGenerator) ? this.lastSelectedIndex : config.initialSelectedIndex || 0;
      this.lastMenuGenerator = menuGenerator;
      return this.displayMenuWithArrows(menuTitle, menu.options, config, initialIndex);
    } else {
      // Traditional numbered mode:
      console.clear();
      if (menuTitle) {
        console.log(`${menuTitle}\n`);
      }
      let optionIndex = 1;
      const optionMap = {};
      for (let option of menu.options) {
        if (option.type === 'options') {
          if (Array.isArray(option.value)) {
            let line = '';
            for (let subOption of option.value) {
              line += `${optionIndex}. ${subOption.name} `;
              optionMap[optionIndex] = subOption;
              optionIndex++;
            }
            console.log(line.trim());
          }
        } else if (option.type === 'text') {
          if (option.value) {
            console.log(option.value);
          }
        } else {
          if (option.name) {
            console.log(`${optionIndex}. ${option.name}`);
            optionMap[optionIndex] = option;
            optionIndex++;
          }
        }
      }
      const choice = parseInt(await this.ask('\nChoose an option: '));
      const chosenOption = optionMap[choice];
      if (chosenOption) {
        if (chosenOption.action) {
          await chosenOption.action();
        } else {
          console.log('Invalid option, try again.');
          await this.displayMenu(menuGenerator, config);
        }
      } else {
        console.log('Invalid option, try again.');
        await this.displayMenu(menuGenerator, config);
      }
    }
  }

  /**
   * Wait for the user to press any key
   * @returns {Promise<void>} - Resolves when a key is pressed.
   */
  pressWait() {
    return new Promise(resolve => {
      console.log('\nPress any key to continue...');
      const onKeyPress = () => {
        stdin.setRawMode(false);
        stdin.removeListener('data', onKeyPress);
        resolve();
      };
      stdin.setRawMode(true);
      stdin.once('data', onKeyPress);
    });
  }

  /**
   * Close the readline interface
   */
  close() {
    this.rl.close();
  }
}

export default TerminalHUD;
