import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path'
import BashrcRefresh from '../../useful/BashrcRefresh.js';

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

    static async NativeInstall() {
        try {
            console.log('Extracting root.tar.gz...');
            const rootPath = path.join(process.cwd(), 'root.tar.gz'); // Replace with your actual path
            const extractPath = process.cwd(); // Replace with your actual path
            await GCC.executeCommand(`tar -xzvf ${rootPath} -C ${extractPath}`);

            console.log('Setting PATH...');
            const binPath = path.join(extractPath, 'root/bin');
            await GCC.executeCommand(`echo "PATH=$PATH:${binPath}" >> /etc/environment`);

            console.log('Installation successful.');
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    static async Install(config = {}) {
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
            } else {
                console.log('devtoolset-11 enable script already present in .bashrc.');
            }

            await BashrcRefresh()

            if (!config.quiet) {
                console.log('Please run "source ~/.bashrc" in your terminal to apply the effects in entire system.');
                console.log('Press any key to continue...');
                return new Promise(resolve => {
                  process.stdin.once('data', () => {
                    resolve();
                  });
                });
              }


        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

/**
 * Checks the GCC version.
 * 
 * @param {Object} [config] - Optional configuration object.
 * @param {boolean} [config.printAndWait] - If true, prints the version and waits for a key press.
 * @returns {Promise<boolean>|Promise<void>} Returns a Promise that resolves to a boolean indicating whether the GCC version is higher than 8.5.0, or resolves when a key is pressed if config.printAndWait is true. Returns false if an error occurs.
 */

    static async Check(config = {}) {
        try {
            console.log('Checking GCC version...');
            const versionOutput = await GCC.executeCommand('gcc --version');
            const version = versionOutput.split('\n')[0].split(' ')[2]; // Assuming 'gcc (GCC) x.y.z' format
            const versionParts = version.split('.').map(Number);
    
            if (config.printAndWait) {
                console.log(versionOutput);
                console.log('Press any key to continue...');
                return new Promise(resolve => {
                    process.stdin.once('data', () => {
                        resolve();
                    });
                });
            } else {
                // Check if version is higher than 8.5.0
                if (versionParts[0] > 8 || (versionParts[0] === 8 && versionParts[1] > 5) || (versionParts[0] === 8 && versionParts[1] === 5 && versionParts[2] > 0)) {
                    return true;
                } else {
                    return false;
                }
            }
        } catch (error) {
            console.error('An error occurred:', error);
            return false;
        }
    }
    
}

export default GCC;