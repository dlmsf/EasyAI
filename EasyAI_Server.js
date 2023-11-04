import http from 'http';
import EasyAI from './EasyAI.js';
import { networkInterfaces } from 'os';
import { URL } from 'url';

class EasyAI_Server {
    constructor(config = { port: 3000, token: '' }) {
        this.port = config.port;
        this.token = config.token || undefined
        this.AI = new EasyAI();

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
                        // Implement streaming logic here
                        // For this example, we will just send chunks periodically
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        this.AI.Generate(requestData.prompt, config, (token) => {
                            console.log(token)
                            res.write(JSON.stringify({ token }));
                            res.flushHeaders()
                        }).catch(error => {
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
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found.' }));
        }
    }

    getPrimaryIP() {
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
        return '127.0.0.1';
    }

    start() {
        this.server.listen(this.port, () => {
            const primaryIP = this.getPrimaryIP();
            console.log(`EasyAI server is running on http://${primaryIP}:${this.port}`);
        });
    }
}

export default EasyAI_Server;
