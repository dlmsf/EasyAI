import http from 'http';
import EasyAI from '../EasyAI.js';
import { networkInterfaces } from 'os';
import { URL } from 'url';
import { exec } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

function execAsync(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

class EasyAI_Server {
    constructor(config = {port: 4000, token: '', EasyAI_Config : {}}) {
        this.port = config.port || 4000;
        this.token = config.token || undefined;
        this.AI = new EasyAI(config.EasyAI_Config);
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
    }

    handleRequest(req, res) {
        const { pathname } = new URL(req.url, `http://${req.headers.host}`);

        if (req.method === 'POST' && pathname === '/generate') {
            let body = '';

            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const requestData = JSON.parse(body);

                    // Token-based authentication
                    if (this.token && requestData.token !== this.token) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid token.' }));
                        return;
                    }

                    // Call the Generate method
                    const config = requestData.config || { stream: false, retryLimit: 60000 };
                    if (config.stream) {
                        res.writeHead(200, { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' });

                        config.tokenCallback = (token) => {
                            // Send each token as a chunk
                            res.write(JSON.stringify(token) + '\n');
                        }

                        this.AI.Generate(requestData.prompt, config).then(result => {
                            // After all chunks are sent, send the final result if it exists
                            if (result) {
                                res.write(JSON.stringify(result));
                            }
                            res.end(); // End the response
                        }).catch(error => {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: error.message }));
                        });
                    } else {
                        this.AI.Generate(requestData.prompt, config).then(result => {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result));
                        }).catch(error => {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: error.message }));
                        });
                    }
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bad request.' }));
                }
            });
        } else if (req.method === 'POST' && pathname === '/chat') {
            let body = '';
    
            req.on('data', chunk => {
                body += chunk.toString();
            });
    
            req.on('end', () => {
                try {
                    const requestData = JSON.parse(body);
    
                    // Token-based authentication
                    if (this.token && requestData.token !== this.token) {
                        res.writeHead(403, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid token.' }));
                        return;
                    }
    
                    // Call the Chat method
                    const config = requestData.config || { stream: false, retryLimit: 60000 };
                    if (config.stream) {
                        res.writeHead(200, { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' });
    
                        config.tokenCallback = (token) => {
                            res.write(JSON.stringify(token) + '\n');
                        }
    
                        this.AI.Chat(requestData.messages, config).then(result => {
                            if (result) {
                                res.write(JSON.stringify(result));
                            }
                            res.end(); // End the response
                        }).catch(error => {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: error.message }));
                        });
                    } else {
                        this.AI.Chat(requestData.messages, config).then(result => {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(result));
                        }).catch(error => {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: error.message }));
                        });
                    }
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bad request.' }));
                }
            });
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found.' }));
        }
    }

    getPrimaryIP() {
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
        return '127.0.0.1';
    }
    
    static async PM2(config) {
        async function findEasyAIServerPath() {
          let filePath = './core/EasyAI_Server.js';
          if (!existsSync(path.resolve(process.cwd(), filePath))) {
            const currentModuleUrl = import.meta.url;
            const currentModulePath = fileURLToPath(currentModuleUrl);
            const currentModuleDir = path.dirname(currentModulePath);
            filePath = path.join(currentModuleDir, 'EasyAI_Server.js');
          }
          return filePath;
        }
    
        const serverScriptPath = './pm2_easyai_server.mjs';
        const easyAIServerPath = await findEasyAIServerPath();
    
        const fileContent = `
          (async () => {
            import EasyAI_Server from '${easyAIServerPath}'
            const config = ${JSON.stringify(config)};
            const server = new EasyAI_Server(config);
            server.start();
          })();
        `;
    
        writeFileSync(serverScriptPath, fileContent);
    
        try {
          const { stdout: pm2ListStdout } = await execAsync(`pm2 list`);
          if (pm2ListStdout.includes('pm2_easyai_server')) {
            await execAsync(`pm2 delete pm2_easyai_server`);
          }
    
          await execAsync(`pm2 start ${serverScriptPath}`);
          console.log("PM2 process successfully managed.");
          return true;
        } catch (error) {
          console.error(`PM2 process management error: ${error.message}`);
          return false;
        }
      }

    start() {
        this.server.listen(this.port, () => {
            const primaryIP = this.getPrimaryIP();
            console.log(`EasyAI server is running on http://${primaryIP}:${this.port}`);
        });
    }
}

export default EasyAI_Server;
