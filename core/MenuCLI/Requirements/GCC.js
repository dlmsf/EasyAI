import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';

class GCC {
    static executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout || stderr);
            });
        });
    }

    static async Install() {
        try {
            console.log('Installing scl repo...');
            await GCC.executeCommand('yum install -y centos-release-scl');

            console.log('Installing devtoolset-11...');
            await GCC.executeCommand('yum install -y devtoolset-11');

            console.log('Checking for existing devtoolset-11 enable in .bashrc...');
            const bashrcPath = os.homedir() + '/.bashrc';
            let bashrcContent = await fs.readFile(bashrcPath, 'utf8');
            const enableString = 'source /opt/rh/devtoolset-11/enable';

            if (!bashrcContent.includes(enableString)) {
                console.log('Appending devtoolset-11 enable script to .bashrc...');
                bashrcContent += `\n${enableString}\n`;
                await fs.writeFile(bashrcPath, bashrcContent, 'utf8');
                console.log('Please run "source ~/.bashrc" in your terminal to apply the effects.');
                console.log('Press any key to continue...');
                return new Promise(resolve => {
                // Listen for a single 'keypress' event.
                process.stdin.once('data', () => {
                    resolve();
                });
            });
            } else {
                console.log('devtoolset-11 enable script already present in .bashrc.');
                console.log('Press any key to continue...');
               return new Promise(resolve => {
                // Listen for a single 'keypress' event.
                process.stdin.once('data', () => {
                    resolve();
                });
            });
                
                
            }
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    static async Check() {
        try {
            console.log('Checking GCC version...');
            const version = await GCC.executeCommand('gcc --version');
            console.log(version);
    
            // Signal completion without manipulating stdin or closing readline.
            // This requires the caller to handle the continuation of interaction.
            console.log('Press any key to continue...');
            return new Promise(resolve => {
                // Listen for a single 'keypress' event.
                process.stdin.once('data', () => {
                    resolve();
                });
            });
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }
}

export default GCC;