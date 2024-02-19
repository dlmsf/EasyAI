import readline from 'readline';

class TerminalHUD {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  ask(question) {
    return new Promise(resolve => {
      this.rl.question(question, answer => {
        resolve(answer);
      });
    });
  }

  async displayMenu(menuGenerator,config = {props : {},clearScreen : true}) {
    if(config.clearScreen == undefined){config.clearScreen = true}
    if(config.props == undefined){config.props = {}}
    if (config.clearScreen == true) {
      console.clear();
    }

    const menu = menuGenerator(config.props); // Generate menu using external state

    console.log(menu.title);
    menu.options.forEach((option, index) => {
      console.log(`${index + 1}. ${option.name}`);
    });

    const choice = parseInt(await this.ask('\nChoose an option: '));
    const chosenOption = menu.options[choice - 1];

    if (chosenOption) {
      await chosenOption.action();
    } else {
      console.log('Invalid option, try again.');
      await this.displayMenu(menuGenerator, clearScreen);
    }
  }

  close() {
    this.rl.close();
  }
}

export default TerminalHUD

// Use Example \/
/*
// External variable for dynamic menu content
let dynamicOption = 'cocozao';

let dinamicao = 'menuzao'

// Menu generation functions
const createSubMenu1 = () => ({
  title: dinamicao,
  options: [
    {
      name: 'Collect Data',
      action: async () => {
        const userData = await terminalHUD.ask('Please enter some data: ');
        dinamicao = userData;
        await terminalHUD.displayMenu(createSubMenu1, true);
      }
    },
    {
      name: dynamicOption,
      action: async () => {
        console.log(`Selected: ${dynamicOption}`);
        await terminalHUD.displayMenu(createSubMenu1, true);
      }
    },
    {
      name: 'Back to Main Menu',
      action: () => terminalHUD.displayMenu(createMainMenu, true)
    }
  ]
});

const createMainMenu = () => ({
  title: 'Main Menu',
  options: [
    { name: 'Submenu 1', action: () => terminalHUD.displayMenu(createSubMenu1, true) },
    { name: 'Exit', action: () => terminalHUD.close() }
  ]
});

const terminalHUD = new TerminalHUD();
terminalHUD.displayMenu(createMainMenu, true);
*/