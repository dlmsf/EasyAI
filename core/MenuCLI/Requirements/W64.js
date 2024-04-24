import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import downloadFile from '../../../useful/downloadFile.js';
import { promisify } from 'util';

const execAsync = promisify(exec);

class W64 {
    static executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(`${command} >nul 2>&1`, { shell: 'cmd.exe' }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout || stderr);
            });
        });
    }
    

    static async install() {
        try {
            const downloadUrl = 'https://github.com/skeeto/w64devkit/releases/download/v1.22.0/w64devkit-fortran-1.22.0.zip';
            const zipFilename = downloadUrl.split('/').pop();
            const unzipPath = os.homedir() + '\\Downloads\\w64devkit'; // Specify the path to extract files

            console.log('Downloading w64devkit...');
            await downloadFile(downloadUrl);

            console.log('Extracting w64devkit...');
            await W64.executeCommand(`powershell Expand-Archive -Path "${zipFilename}" -DestinationPath "${unzipPath}" -Force`);

            console.log('Adding w64devkit to PATH...');
            const binPath = `${unzipPath}\\bin`;
            await W64.executeCommand(`setx path "%PATH%;${binPath}"`);

            console.log('w64devkit is installed and ready to use.');
            console.log('Please restart your command prompt to use w64devkit.');
            console.log('Press any key to continue...');

            await new Promise(resolve => {
                process.stdin.setRawMode(true);
                process.stdin.resume();
                process.stdin.on('data', () => {
                    process.stdin.setRawMode(false);
                    resolve();
                });
            });
        } catch (error) {
            console.error('An error occurred:', error);
            console.log('Press any key to continue...');
            await new Promise(resolve => {
                process.stdin.setRawMode(true);
                process.stdin.resume();
                process.stdin.on('data', () => {
                    process.stdin.setRawMode(false);
                    resolve();
                });
            });
        }
    }
}

export default W64;