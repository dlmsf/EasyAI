import EasyAI from "../EasyAI.js";
import http from 'http';
import fs from 'fs';
import path from 'path';

/**
 * Class representing a single instance web server for serving a chat interface.
 * This class implements the Singleton pattern to ensure only one instance and server is created.
 */
class EasyAI_WebView {
    static instance = null;

    /**
     * Creates an instance of EasyAI_WebView. If an instance already exists, it returns the existing one.
     * @param {Object} config - Configuration object for the web server.
     * @param {number} [config.port=2000] - Port on which the server will listen.
     * @param {string} [config.htmlpath='./core/chat.html'] - Path to the HTML file to be served.
     */
    constructor(config = {}) {
        if (EasyAI_WebView.instance) {
            return EasyAI_WebView.instance;
        }
        this.port = config.port || 2000;

        this.server = http.createServer((req, res) => {
            if (req.url === '/') {
                // Serving a basic HTML page
                const filePath = config.htmlpath || './core/chat.html';
                fs.readFile(filePath, (err, content) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error occurred');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            }
        });

        this.server.listen(this.port, () => {
            console.log(`Server is running on http://localhost:${this.port}`);
        });

        EasyAI_WebView.instance = this;
    }
}

export default EasyAI_WebView;
