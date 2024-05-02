import http from 'http';
import fs from 'fs';
import path from 'path';
import WebSocket from './WebSocket.js';

function tokenize(text) {
    return text.trim().match(/(?:^|\s+)(\S+)/g);
  }

async function defaultInputFunction(input, callback) {
    console.log(input)
    const tokens = ['You', ' typed: ', ...tokenize(input)];
    for (const token of tokens) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing delay
        callback(token);
    }
}

class EasyAI_WebGPT {
    static instance = null;

    constructor(config = {}) {
        if (EasyAI_WebGPT.instance) {
            return EasyAI_WebGPT.instance;
        }
        this.port = config.port || 3000;
        this.processInputFunction = config.inputFunction || defaultInputFunction;

        this.server = http.createServer((req, res) => {
            if (req.url === '/' ) {
                const filePath = config.htmlpath || './core/chat.html';
                fs.readFile(filePath, (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Server Error: Could not read file');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        const wsServer = new WebSocket(this.port + 1);
        wsServer.on('message', async (socket, message) => {
            await this.processInputFunction(message, (response) => {
                wsServer.send(socket, JSON.stringify({type: 'token', token: response}));
            });
            wsServer.send(socket, JSON.stringify({ type: "end-of-response" }));
        });

        this.server.on('upgrade', (req, socket, head) => {
            wsServer.handleUpgrade(req, socket, head);
        });

        this.server.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`);
            console.log(`WebSocket server is running on ws://localhost:${this.port + 1}`);
        });

        EasyAI_WebGPT.instance = this;
    }
}

export default EasyAI_WebGPT;
