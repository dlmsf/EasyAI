import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import downloadFile from '../../useful/downloadFile.js'

class W64 {
    static executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { shell: 'cmd.exe' }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Non-fatal error occurred:', stderr);
                    resolve(stdout);  // Continue despite the error
                    return;
                }
                resolve(stdout);
            });
        });
    }

    static async install() {
        try {
            const downloadUrl = 'https://github.com/skeeto/w64devkit/releases/download/v1.22.0/w64devkit-fortran-1.22.0.zip';
            const zipFilename = downloadUrl.split('/').pop();
            const targetDirectory = 'C:\\w64devkit';

            console.log('Downloading w64devkit...');
            await downloadFile(downloadUrl); // Ensure this function saves the file to a known directory, e.g., os.homedir() + '\\Downloads\\'

            console.log('Ensuring target directory exists...');
            await fs.mkdir(targetDirectory, { recursive: true });

            console.log('Extracting w64devkit...');
            await W64.executeCommand(`tar -xf ${os.homedir()}\\Downloads\\${zipFilename} -C ${targetDirectory}`);

            console.log('Adding w64devkit to the system PATH...');
            const binPath = `${targetDirectory}\\w64devkit\\bin`;  // Adjust based on actual path
            await W64.executeCommand(`setx /M PATH "%PATH%;${binPath}"`);

            console.log('w64devkit is installed and ready to use.');
            console.log('Please restart your computer or log out and back in to use w64devkit.');
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
            console.error('An error occurred, but installation may be complete:', error);
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
