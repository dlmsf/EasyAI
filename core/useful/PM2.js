import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';

const execAsync = promisify(exec);

class PM2 {

  static async Check(config = { printExecutionTime: false }) {
    const startTime = Date.now();
    try {
      let globalNodeModules;
      switch (os.platform()) {
        case 'win32':
          // On Windows, global packages are stored in %AppData%\npm\node_modules
          globalNodeModules = path.join(process.env.APPDATA, 'npm', 'node_modules');
          break;
        default:
          // On Unix-like systems, get the global node_modules path dynamically using npm -g root
          const { stdout } = await execAsync('npm -g root');
          globalNodeModules = stdout.trim();
      }
      const result = fs.existsSync(path.join(globalNodeModules, 'pm2'));
      if (config.printExecutionTime) {
        const endTime = Date.now();
        console.log(`Execution time: ${endTime - startTime} ms`);
      }
      return result;
    } catch (error) {
      if (config.printExecutionTime) {
        const endTime = Date.now();
        console.log(`Execution time: ${endTime - startTime} ms`);
      }
      return false; // Error occurred, likely PM2 is not installed
    }
  }
  
  static async Install() {
    try {
      console.log('Installing PM2 globally...');
      const { stdout } = await execAsync('npm install -g pm2');
      console.log(stdout);
      console.log('PM2 has been installed successfully.');
    } catch (error) {
      console.error('Failed to install PM2:', error);
    }
  }

  static async Process(name) {
    try {
      const { stdout } = await execAsync('pm2 list -m');
      const lines = stdout.split('\n');
      for (let line of lines) {
        const processName = line.split(/\s+/)[1]; // The process name is the second column in the output
        if (processName === name) {
          return true; // The process exists
        }
      }
      return false; // The process does not exist
    } catch (error) {
      //console.error('Failed to check the process:', error);
      return false; // Error occurred, likely the process does not exist
    }
  }
  
  

  static async Delete(name) {
    try {
      console.log(`Deleting the process ${name}...`);
      const { stdout } = await execAsync(`pm2 delete ${name}`);
      console.log(stdout);
      console.log(`The process ${name} has been deleted successfully.`);
    } catch (error) {
      console.error(`Failed to delete the process ${name}:`, error);
    }
  }

}

export default PM2