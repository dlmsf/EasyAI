import { promises as fsPromises, createWriteStream } from 'fs';
import path , { join } from 'path';
import https from 'https';
import {exec, spawn} from 'child_process'
import findDirectory from '../../useful/findDirectory.js';
import http from 'http'

async function CompletionPostRequest(bodyObject) {
    const url = new URL("http://localhost:8080/completion");

    const options = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8'
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error("Failed to parse response as JSON: " + data));
                    }
                } else {
                    reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (error) => {
            console.error("Erro no CompletationPostRequest()", error);
            reject(error);
        });

        req.write(JSON.stringify(bodyObject));
        req.end();
    });
}

class LlamaCPP {
    constructor(config = {modelpath : ''}) {
        if (config.modelpath) {
            this.ModelPath = path.join(process.cwd(), config.modelpath);
        } else {
            this.ModelPath = '';
        }
        this.ModelLoaded = false;
        this.llamaCPP_installed = false
        this.ServerOn = false

        this.Start()
        
    }


/*

let cpp_path = await findDirectory(process.cwd(), 'llama.cpp');
        if (cpp_path) {
            console.log('Executing command line...');

            let make = spawn('make', ['-j'], { cwd: cpp_path, stdio: 'inherit' });

            make.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`make process exited with code ${code}`);
                    return;
                }

                let mainArgs = ['-m', this.ModelPath, '-p', prompt, '-n', '400', '-e'];
                let executeMain = spawn('./main', mainArgs, { cwd: cpp_path, stdio: 'inherit' });

                executeMain.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`./main process exited with code ${code}`);
                    }
                });
            });

            make.on('error', (err) => {
                console.error('Error executing make:', err);
            });
        }

*/

async Start(){
    await this.initializeModelPath();
    await this.initializeLlamaCPPRepo()
    await this.LlamaServer()
}

async LlamaServer(){

    let cpp_path = await findDirectory(process.cwd(), 'llama.cpp');
    if (cpp_path) {
        console.log('Executing command line...');

        let make = spawn('make', ['-j'], { cwd: cpp_path, stdio: 'inherit' });

        make.on('exit', (code) => {
            if (code !== 0) {
                console.error(`make process exited with code ${code}`);
                return;
            }

            let mainArgs = ['-m', this.ModelPath, '-c',2048];
            let executeMain = spawn('./server', mainArgs, { cwd: cpp_path, stdio: 'inherit' });

            //Caso o server tenah sido ligado com sucesso setar a propriedade this.ServerOn = true, e inserir a condição no generat

            executeMain.on('exit', (code) => {
                if (code !== 0) {
                    console.error(`./main process exited with code ${code}`);
                }
            });
        });

        make.on('error', (err) => {
            console.error('Error executing make:', err);
        });
    }


}

async Generate(prompt = 'Once upon a time') {
    if (this.ModelLoaded && this.llamaCPP_installed) {

       return await CompletionPostRequest({prompt : prompt})
        
    } else {
        console.error('Erro no LlamaCPP.Generate() | Modelo não carregado ou llama.cpp não encontrado');
        return false;
    }
}


    

    async initializeLlamaCPPRepo() { 
        const llamaCPPDir = path.join(process.cwd(), 'llama.cpp');

        if (!await this.directoryExists(llamaCPPDir)) {
            console.log('Cloning the llama.cpp repository...');
            exec('git clone https://github.com/ggerganov/llama.cpp.git', { cwd: process.cwd() }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Failed to clone the llama.cpp repository:', error);
                } else {
                    this.llamaCPP_installed = true;
                    console.log('llama.cpp repository cloned successfully!');
                }
            });
        } else {
            this.llamaCPP_installed = true;
            console.log('llama.cpp repository already exists.');
        }
    }

    async initializeModelPath() {
        const modelsDir = path.join(process.cwd(), './models');
    
        if (!await this.directoryExists(modelsDir)) {
            await fsPromises.mkdir(modelsDir);
        }
    
        
        if (this.ModelPath) {
            if (!this.ModelPath.endsWith('.gguf')) {
                console.error('Provided model path is not in .gguf format.');
            } else {
                try {
                    await fsPromises.access(this.ModelPath);
                    console.log(`Llama Model successfully loaded: ${this.ModelPath}`);
                    this.ModelLoaded = true;
                    return;
                } catch {
                    console.error('Provided model path is not valid.');
                }
            }
        }
    
        const modelFilePath = await this.getLargestGGUF(modelsDir);
        if (modelFilePath) {
            this.ModelPath = modelFilePath;
            console.log(`\nLlama Model successfully loaded: ${this.ModelPath}`);
            this.ModelLoaded = true;
        } else {
            const shouldDownload = await this.promptDownloadModel();
            if (shouldDownload) {
                await this.loadSampleModel(modelsDir);
                this.ModelPath = path.join(process.cwd(), this.ModelPath);
            } else {
                console.log('No Llama Model was loaded.');
            }
        }
    }

    async loadSampleModel(modelsDir) {
        const downloadURL = 'https://huggingface.co/TheBloke/Llama-2-7b-Chat-GGUF/resolve/main/llama-2-7b-chat.Q3_K_L.gguf';
        const destPath = join(modelsDir, 'llama-2-7b-chat.Q3_K_L.gguf');
        await this.downloadFile(downloadURL, destPath);
        this.ModelPath = destPath;
        console.log(`\nLlama Model successfully downloaded and loaded from: ${this.ModelPath}`);
        this.ModelLoaded = true;
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