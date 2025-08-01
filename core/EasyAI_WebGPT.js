import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { writeFileSync, existsSync } from 'fs';
import EasyAI from '../EasyAI.js';
import ChatPrompt from './MenuCLI/Sandbox/ChatPrompt.js';
import Chat from './ChatModule/Chat.js';
import PM2 from './useful/PM2.js';

function execAsync(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout, stderr });
    });
  });
}

class EasyAI_WebGPT {
  static instance = null;

  constructor(config = {}) {
    if (EasyAI_WebGPT.instance) return EasyAI_WebGPT.instance;

    this.port = config.port || 3000;
    this.Chat = new Chat();
    this.easyai_url = config.easyai_url || ((config.openai_token) ? undefined : 'localhost');
    this.easyai_port = config.easyai_port || 4000;
    this.AI = new EasyAI({ server_url: this.easyai_url, server_port: this.easyai_port, openai_token: config.openai_token, openai_model: config.openai_model });

    this.server = http.createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/') {
        let filePath = config.htmlpath || './core/chat.html';
        if (!fs.existsSync(path.resolve(process.cwd(), filePath))) {
          const currentModulePath = path.dirname(fileURLToPath(import.meta.url));
          filePath = path.join(currentModulePath, 'chat.html');
        }
        fs.readFile(filePath, 'utf8', (err, content) => {
          if (err) {
            res.writeHead(500);
            return res.end('Server Error');
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        });
      } else if (req.method === 'POST' && req.url === '/message') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          const { message } = JSON.parse(body);
          this.Chat.NewMessage('User: ', message);
          let historical_prompt = '';
          this.Chat.Historical.forEach(e => {
            historical_prompt += `${e.Sender}${e.Content} | `;
          });

          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          });

          const result = await this.AI.Generate(`${ChatPrompt}${historical_prompt}AI:`, {
            tokenCallback: async (token) => {
              res.write(`data: ${token.stream.content}\n\n`);
            },
            stop: ['|']
          });

          this.Chat.NewMessage('AI: ', result.full_text);
          res.write('data: [DONE]\n\n');
          res.end();
        });
      } else if (req.method === 'POST' && req.url === '/reset') {
        this.Chat.Reset();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'reset' }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, () => {
      console.log(`Server running: http://localhost:${this.port}`);
    });

    EasyAI_WebGPT.instance = this;
  }

  static async PM2(config) {
    const timestamp = Date.now();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const uniqueFileName = `pm2_webgpt_${timestamp}_${randomSuffix}.mjs`;
    const serverScriptPath = path.join('/tmp', uniqueFileName);

    const currentModulePath = path.dirname(fileURLToPath(import.meta.url));
    const easyAIServerPath = pathToFileURL(path.join(currentModulePath, '../EasyAI.js')).href;

    const fileContent = `import EasyAI from '${easyAIServerPath}';
const config = ${JSON.stringify(config)};
const server = new EasyAI.WebGPT(config);`;

    writeFileSync(serverScriptPath, fileContent);

    if (!(await PM2.Check())) await PM2.Install();

    try {
      await execAsync(`pm2 start ${serverScriptPath}`);
      console.log("PM2 process successfully managed.");
      return true;
    } catch (error) {
      console.error("PM2 error:", error.message);
      return false;
    }
  }
}

export default EasyAI_WebGPT;
