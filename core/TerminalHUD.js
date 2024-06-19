import readline from 'readline';

class TerminalHUD {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.loading = false;
  }

  startLoading() {
    this.loading = true;
    let i = 0;
    this.loadingInterval = setInterval(() => {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(`⏳ Loading${'.'.repeat(i)}`);
      i = (i + 1) % 4;
    }, 500);
  }

  stopLoading() {
    this.loading = false;
    clearInterval(this.loadingInterval);
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
  }

  async ask(question, config = {}) {
    if (config.options) {
      return this.displayMenuFromOptions(question, config.options);
    } else {
      return new Promise(resolve => {
        this.rl.question(`\n${question}`, answer => {
          resolve(answer);
        });
      });
    }
  }

  async displayMenuFromOptions(question, options) {
    console.log(`\n${question}\n`);
    let optionIndex = 1;
    for (let index = 0; index < options.length; index++) {
      if (Array.isArray(options[index])) {
        let line = '';
        for (let subIndex = 0; subIndex < options[index].length; subIndex++) {
          line += `${optionIndex}. ${await options[index][subIndex]} `;
          optionIndex++;
        }
        console.log(line.trim());
      } else {
        console.log(`${optionIndex}. ${await options[index]}`);
        optionIndex++;
      }
    }
  
    const choice = parseInt(await this.ask('Choose an option: '));
    return options.flat()[choice - 1];
  }
  

  async displayMenu(menuGenerator,config = {props : {},clearScreen : true,alert : undefined,alert_emoji : '⚠️'}) {
    if(config.clearScreen == undefined){config.clearScreen = true}
    if(config.props == undefined){config.props = {}}
    if (config.clearScreen == true) {
      console.clear();
    }
  
    this.startLoading();
    const menu = await menuGenerator(config.props);
    this.stopLoading();
  
    if (config.alert) {
      console.log(`${config.alert_emoji || '⚠️'}  ${config.alert}\n`);
    }
    console.log(await menu.title);
  
    let optionIndex = 1;
    for (let index = 0; index < menu.options.length; index++) {
      if (Array.isArray(menu.options[index])) {
        let line = '';
        for (let subIndex = 0; subIndex < menu.options[index].length; subIndex++) {
          line += `${optionIndex}. ${await menu.options[index][subIndex].name} `;
          optionIndex++;
        }
        console.log(line.trim());
      } else {
        console.log(`${optionIndex}. ${await menu.options[index].name}`);
        optionIndex++;
      }
    }
  
    const choice = parseInt(await this.ask('\nChoose an option: '));
    const chosenOption = menu.options.flat()[choice - 1];
  
    if (chosenOption) {
      await chosenOption.action();
    } else {
      console.log('Invalid option, try again.');
      await this.displayMenu(menuGenerator);
    }
  }
  

  pressWait() {
    return new Promise(resolve => {
      console.log('\nPress any key to continue...');
      const onKeyPress = () => {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKeyPress);
        resolve();
      };
      process.stdin.setRawMode(true);
      process.stdin.once('data', onKeyPress);
    });
  }

  close() {
    this.rl.close();
  }
}

export default TerminalHUD