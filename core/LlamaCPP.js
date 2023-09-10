import { promises as fsPromises, createWriteStream } from 'fs';
import { join } from 'path';
import https from 'https';

class LlamaCPP {
    constructor(config = {}) {
        this.ModelPath = config.modelpath || '';
        if (this.ModelPath && !this.ModelPath.endsWith('.gguf')) {
            throw new Error('Provided model path is not in .gguf format');
        } else {
            this.initializeModelPath();
        }
    }

    Generate() {
        
    }

    async initializeModelPath() {
        const modelsDir = join('./models');

        if (!await this.directoryExists(modelsDir)) {
            await fsPromises.mkdir(modelsDir);
        }

        const modelFilePath = await this.getLargestGGUF(modelsDir);
        if (modelFilePath) {
            this.ModelPath = modelFilePath;
            console.log(`\nLlama Model successfully loaded: ${this.ModelPath}`);
        } else {
            const shouldDownload = await this.promptDownloadModel();
            if (shouldDownload) {
                const downloadURL = 'https://huggingface.co/TheBloke/Llama-2-7b-Chat-GGUF/resolve/main/llama-2-7b-chat.Q3_K_L.gguf';
                const destPath = join(modelsDir, 'llama-2-7b-chat.Q3_K_L.gguf');
                await this.downloadFile(downloadURL, destPath);
                this.ModelPath = destPath;
                console.log(`\nLlama Model successfully downloaded and loaded from: ${this.ModelPath}`);
            } else {
                console.log('No Llama Model was loaded.');
            }
        }
    }

    async directoryExists(path) {
        try {
            const stats = await fsPromises.stat(path);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    async getLargestGGUF(dir) {
        const files = await fsPromises.readdir(dir);
        let largestFilePath = '';
        let largestFileSize = 0;

        for (const file of files) {
            if (file.endsWith('.gguf')) {
                const filePath = join(dir, file);
                const { size } = await fsPromises.stat(filePath);
                if (size > largestFileSize) {
                    largestFileSize = size;
                    largestFilePath = filePath;
                }
            }
        }
        return largestFilePath;
    }

    promptDownloadModel() {
        return new Promise((resolve) => {
            process.stdout.write('No Llama Model is encountered in models folder. Wanna download a sample Llama Model? (Y/n): ');
            process.stdin.once('data', (data) => {
                const answer = data.toString().trim().toLowerCase();
                resolve(answer === 'y' || answer === '');
            });
        });
    }

    downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const file = createWriteStream(dest);

            const download = (currentUrl) => {
                https.get(currentUrl, (response) => {
                    if (response.statusCode === 200) {
                        const totalBytes = Number(response.headers['content-length']);
                        let downloadedBytes = 0;

                        response.on('data', (chunk) => {
                            downloadedBytes += chunk.length;
                            this.printProgress(downloadedBytes, totalBytes);
                            file.write(chunk);
                        });

                        response.on('end', () => {
                            file.end(() => resolve());
                        });
                    } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        download(response.headers.location);
                    } else {
                        reject(new Error(`Failed to download file. HTTP Status: ${response.statusCode}`));
                    }
                }).on('error', (err) => {
                    fsPromises.unlink(dest).catch(() => {});
                    reject(err);
                });
            };

            download(url);
        });
    }

    printProgress(downloaded, total) {
        const percentage = (downloaded / total) * 100;
        const progressBarLength = 50;
        const numberOfBlocks = Math.floor((percentage / 100) * progressBarLength);
        const progressBlocks = '#'.repeat(numberOfBlocks);
        const emptyBlocks = ' '.repeat(progressBarLength - numberOfBlocks);
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`Downloading Llama Model: [${progressBlocks}${emptyBlocks}] ${percentage.toFixed(2)}%`);
    }
}

export default LlamaCPP;