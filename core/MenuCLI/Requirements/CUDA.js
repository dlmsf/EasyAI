import { exec } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';

class CUDA {
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
            console.log('Installing NVIDIA driver...');
            await CUDA.executeCommand('yum -y install nvidia-driver-latest-dkms');

            console.log('Downloading CUDA repository RPM...');
            await CUDA.executeCommand('wget https://developer.download.nvidia.com/compute/cuda/12.3.2/local_installers/cuda-repo-rhel7-12-3-local-12.3.2_545.23.08-1.x86_64.rpm');

            console.log('Installing CUDA repository...');
            await CUDA.executeCommand('rpm -i cuda-repo-rhel7-12-3-local-12.3.2_545.23.08-1.x86_64.rpm');

            console.log('Cleaning yum caches...');
            await CUDA.executeCommand('yum clean all');

            console.log('Installing CUDA Toolkit...');
            await CUDA.executeCommand('yum -y install cuda-toolkit-12-3');

            console.log('Checking for existing CUDA path in .bashrc...');
            const bashrcPath = os.homedir() + '/.bashrc';
            let bashrcContent = await fs.readFile(bashrcPath, 'utf8');
            const exportString = 'export PATH=/usr/local/cuda/bin:$PATH';

            if (!bashrcContent.includes(exportString)) {
                console.log('Appending CUDA path to .bashrc...');
                bashrcContent += `\n${exportString}\n`;
                await fs.writeFile(bashrcPath, bashrcContent, 'utf8');

                console.log('Sourcing .bashrc to update environment...');
                // Note: This will not affect the parent shell environment.
                await CUDA.executeCommand('source ~/.bashrc');
            } else {
                console.log('CUDA path already present in .bashrc.');
                console.log('Sourcing .bashrc to update environment...');
                // Note: This will not affect the parent shell environment.
                await CUDA.executeCommand('source ~/.bashrc');
            }
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }

    static async Check() {
        try {
            console.log('Checking nvcc version...');
            const version = await CUDA.executeCommand('nvcc --version');
            console.log(version);
    
            console.log('Installation and version check complete. Press any key to continue...');
        } catch (error) {
            console.error('An error occurred:', error);
        }
    }
}

export default CUDA;
