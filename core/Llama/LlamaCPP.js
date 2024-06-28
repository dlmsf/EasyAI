import { promises as fsPromises, createWriteStream } from 'fs';
import path , { join } from 'path';
import https from 'https';
import {exec, spawn} from 'child_process'
import findDirectory from '../useful/findDirectory.js'
import Git from '../useful/Git.js'
import http from 'http'
import System from '../useful/System.js';
import CheckFile from '../useful/CheckFile.js';
import LlamacppRepo from '../MenuCLI/Requirements/LlamacppRepo.js'
import ConfigManager from '../ConfigManager.js';
import BashrcRefresh from '../useful/BashrcRefresh.js';
import FixBuildInfo from './FixBuildInfo.js';

const Sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function CompletionPostRequest(bodyObject,config,streamCallback,port = 8080) {
    const url = new URL(`http://127.0.0.1:${port}/completion`);

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
            let final_text = ''

            res.on('data', (chunk) => {
                data += chunk;

                if (bodyObject.stream) {
                    try {
                        let stream = chunk.toString()
                        if (stream.startsWith("data: ")) {
                            stream = stream.substring("data: ".length);
                        }
                        stream = JSON.parse(stream);
                        if(stream.generation_settings){
                            stream.content = final_text
                            resolve(stream)
                        } else {
                            //Aqui inserir a maneira de cuspir esses stream_event 
                            //para forada função sem perder o resolve final com o objeto completo
                            final_text += stream.content
                            streamCallback && streamCallback({full_text : final_text,stream})
                        }
                        //console.log("Received streamed message:", stream);
                    } catch (error) {
                        console.error("Failed to parse a streamed chunk as JSON:", chunk.toString());
                    }
                }
            });

            res.on('end', () => {
                if (!bodyObject.stream) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (error) {
                            reject(new Error("Failed to parse response as JSON: " + data));
                        }
                    } else {
                        reject(new Error(`Request failed with status ${res.statusCode}: ${data}`));
                    }
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
    constructor(config = {server_port : undefined,git_hash : undefined ,modelpath : '',cuda : false,gpu_layers : undefined,threads : undefined,lora : undefined,lorabase : undefined,context : undefined,slots : undefined,mlock : undefined,mmap : undefined}) {
        if (config.modelpath) {
            this.ModelPath = path.join(process.cwd(), config.modelpath);
        } else {
            this.ModelPath = '';
        }
        this.GitHash = config.git_hash || undefined
        this.Cuda = config.cuda || false
        this.Context = (config.context) ? ((typeof config.context == 'number') ? config.context : 2048) : 2048
        this.GPU_Layers = config.gpu_layers || this.Cuda ? 999 : undefined
        this.Threads = config.threads || undefined
        this.Slots = config.slots || undefined
        this.Mlock = config.mlock || false
        this.Mmap = config.mmap || false
        this.LoraPath = config.lora || undefined
        this.LoraBase = config.lorabase || false
        this.ModelLoaded = false;
        this.llamaCPP_installed = false
        this.ServerPort = config.server_port || 8080
        this.ServerOn = false

        this.Start()
        
    }



async Start(){
    await this.initializeModelPath();
    await this.initializeLlamaCPPRepo()
    await this.LlamaServer()
}



async LlamaServer() {
    let cpp_path = await findDirectory(process.cwd(), 'llama.cpp');
    if (!cpp_path) {
        console.error('llama.cpp directory not found.');
        return;
    }

    let system = System()
    if(system == 'linux'){
        await BashrcRefresh()
        FixBuildInfo()
    }

    console.log('Executing command lines...');
    try {

        if(this.GitHash){
            let actual_hash = await Git.ActualHash(cpp_path)
            if(actual_hash != this.GitHash){
               await Git.Checkout(cpp_path,this.GitHash)
            }
        }
        
        let system = System()
        let has_build = await CheckFile('./llama.cpp/server.exe')

        if(system == 'linux' || !has_build){
        await this.runMake(cpp_path);
        }
        this.executeMain(cpp_path);
        await Sleep(2500) // REMOVER ESSA PORCARIA DEPOIS NÃO TM QUE ESPERAR COM SLEEP COISA NENHUMA, TEM QUE TER UMA VERIFICAÇÃO CORRETA
        this.ServerOn = true; 
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

runMake(cpp_path) {
    return new Promise((resolve, reject) => {
        let args = ['-j']
        if(this.Cuda){args.push('LLAMA_CUBLAS=1')}
        let make = spawn('make', args, { cwd: cpp_path, stdio: 'inherit' });

        make.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`make process exited with code ${code}`));
            } else {
                resolve();
            }
        });

        make.on('error', (err) => {
            reject(new Error('Error executing make:', err));
        });
    });
}

executeMain(cpp_path) {
    return new Promise((resolve, reject) => {
        let mainArgs = ['-m', this.ModelPath, '-c', this.Context,'--port',this.ServerPort];
        if(this.Threads && typeof this.Threads == 'number'){
            mainArgs.push('-t')
            mainArgs.push(this.Threads)
        }
        if(this.GPU_Layers && typeof this.GPU_Layers == 'number'){
            mainArgs.push('-ngl')
            mainArgs.push(this.GPU_Layers)
        }
        if(this.Mlock){
            mainArgs.push('--mlock')
        }
        if(this.Mmap){
            mainArgs.push('--no-mmap')
        }
        if(this.Slots && typeof this.Slots == 'number' && this.Slots > 0){
            mainArgs.push('-np')
            mainArgs.push(this.Slots)
        }
        if(this.LoraPath){
            if(this.LoraBase){
                mainArgs.push('--lora-base')
            } else {
                mainArgs.push('--lora')
            }
            
            mainArgs.push(this.LoraPath)
        }

        let executeMain = spawn('./server', mainArgs, { cwd: cpp_path, stdio: 'inherit' });

        executeMain.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`./main process exited with code ${code}`));
            } else {
                resolve();
            }
        });

        executeMain.on('error', (err) => {
            reject(new Error('Error executing ./main:', err));
        });
    });
}

async Generate(prompt = 'Once upon a time',config = {logerror : false, stream : false},tokenCallback) {
    if (this.ModelLoaded && this.llamaCPP_installed && this.ServerOn) {

       return await CompletionPostRequest({prompt : prompt,...config},{},(stream) => {tokenCallback && tokenCallback(stream)},this.ServerPort)
        
    } else {
        if(config.logerror){
            console.error('Erro no LlamaCPP.Generate() | Modelo não carregado ou llama.cpp não encontrado');
        }
        return false;
    }
}

    async initializeLlamaCPPRepo() {
    const llamaCPPDir = path.join(process.cwd(), 'llama.cpp');

    if (!await this.directoryExists(llamaCPPDir)) {
        console.log('Cloning/Extracting the llama.cpp repository...');
        if(ConfigManager.getKey('gh-llama')){
            await LlamacppRepo.cloneRepository()
        } else {
            await LlamacppRepo.Extract() 
        }
    } else {
        this.llamaCPP_installed = true;
        console.log('llama.cpp repository already exists.');
        }
    }

    async cloneRepository() {
    return new Promise((resolve, reject) => {
        exec('git clone https://github.com/ggerganov/llama.cpp.git', { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
                }
            });
        });
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
    
        const modelFilePath = ConfigManager.getKey('automodel-smaller') ? this.getSmallestGGUF(modelsDir) : await this.getLargestGGUF(modelsDir);
        if (modelFilePath) {
            this.ModelPath = modelFilePath;
            console.log(`\nLlama Model successfully loaded: ${this.ModelPath}`);
            this.ModelLoaded = true;
        } else {
            const shouldDownload = await this.promptDownloadModel();
            if (shouldDownload) {
                await this.loadSampleModel(modelsDir);
            } else {
                console.log('No Llama Model was loaded.');
            }
        }
    }

    async loadSampleModel(modelsDir) {
        const downloadURL = 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf';
        const destPath = join(modelsDir, 'Phi-3-mini-4k-instruct-q4.gguf');
        await this.downloadFile(downloadURL, destPath);
        this.ModelPath = await this.getLargestGGUF(modelsDir);
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

    async getSmallestGGUF(dir) {
        const files = await fsPromises.readdir(dir);
        let smallestFilePath = '';
        let smallestFileSize = Infinity;
      
        for (const file of files) {
          if (file.endsWith('.gguf')) {
            const filePath = join(dir, file);
            const { size } = await fsPromises.stat(filePath);
            if (size < smallestFileSize) {
              smallestFileSize = size;
              smallestFilePath = filePath;
            }
          }
        }
        return smallestFilePath;
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
                        const newUrl = new URL(response.headers.location, currentUrl).toString();
                        download(newUrl);
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