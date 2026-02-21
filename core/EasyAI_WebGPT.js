import http from 'http';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { writeFileSync, existsSync } from 'fs';
import EasyAI from '../EasyAI.js';
import Chat from './ChatModule/Chat.js';
import PM2 from './useful/PM2.js';
import ChatView from './ChatView.js'
import { promisify } from 'util';
import { networkInterfaces } from 'os';
import FreePort from './useful/FreePort.js';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

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

  constructor(config = {handle_port : true}) {
    if (EasyAI_WebGPT.instance) return EasyAI_WebGPT.instance;

    this.handle_port = config.handle_port || true
    this.port = config.port || 3000;
    this.Chat = new Chat();
    
    // Store messages in the format Chat() expects
    this.messages = []; // We'll use this alongside Chat.Historical for compatibility
    
    // Build the config for EasyAI based on what's provided
    const easyAIConfig = {};
    
    // If we have OpenAI token, use that (this works in Chat/Generate mode)
    if (config.openai_token) {
      easyAIConfig.openai_token = config.openai_token;
      easyAIConfig.openai_model = config.openai_model;
    }
    // If we have DeepInfra token, use that (this works in Chat/Generate mode)
    else if (config.deepinfra_token) {
      easyAIConfig.deepinfra_token = config.deepinfra_token;
      easyAIConfig.deepinfra_model = config.deepinfra_model;
    }
    // If we have server URL, use that (this works in Chat/Generate mode)
    else if (config.easyai_url) {
      easyAIConfig.server_url = config.easyai_url;
      easyAIConfig.server_port = config.easyai_port || 4000;
    }
    
    console.log('Creating EasyAI with config:', easyAIConfig);
    this.AI = new EasyAI(easyAIConfig);

    // Optional: Set system message type
    this.systemType = config.systemType || 'FRIENDLY';

    this.server = http.createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/') { 
        try {
          // 1. Create temporary file with ChatView.Html() content
          const tempFilePath = path.join(process.cwd(), 'temp_chat.html');
          await writeFile(tempFilePath, ChatView.Html(), 'utf8');
          
          // 2. Use your existing file-serving logic
          let filePath = config.htmlpath || './core/chat.html';
          if (!fs.existsSync(path.resolve(process.cwd(), filePath))) {
              const currentModulePath = path.dirname(fileURLToPath(import.meta.url));
              filePath = path.join(currentModulePath, 'chat.html');
          }
          
          // 3. Temporarily override the file path to use our temp file
          filePath = tempFilePath;
          
          // 4. Read and serve the file
          fs.readFile(filePath, 'utf8', async (err, content) => {
              try {
                  // 5. Delete the temp file after sending response
                  await unlink(tempFilePath).catch(console.error);
                  
                  if (err) {
                      res.writeHead(500);
                      return res.end('Server Error');
                  }
                  res.writeHead(200, { 'Content-Type': 'text/html' });
                  res.end(content);
              } catch (cleanupError) {
                  console.error('Cleanup error:', cleanupError);
              }
          });
      } catch (setupError) {
          console.error('Setup error:', setupError);
          res.writeHead(500);
          res.end('Server Error');
      }
      } else if (req.method === 'POST' && req.url === '/message') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const { message } = JSON.parse(body);
            console.log('Received message:', message);
            
            // Add user message to both storage formats (for compatibility)
            this.Chat.NewMessage('User: ', message);
            this.messages.push({ role: 'user', content: message });

            // Build messages array for Chat() method
            const messagesForAI = this.messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }));
            
            console.log('Messages for AI:', JSON.stringify(messagesForAI));

            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Store the complete response as we build it
            let fullResponse = '';
            let tokenCount = 0;

            console.log('Starting AI.Chat...');
            
            // Determine if we need to pass any special flags based on what we're using
            const chatConfig = {
              tokenCallback: async (token) => {
                try {
                  // Extract content
                  let content = '';
                  
                  if (typeof token === 'string') {
                    content = token;
                  } else if (token?.stream?.content) {
                    content = token.stream.content;
                  } else if (token?.content) {
                    content = token.content;
                  } else {
                    console.log('Unknown token format:', token);
                    return; // Skip unknown formats
                  }
                  
                  if (content) {
                    tokenCount++;
                    // Accumulate for history
                    fullResponse += content;
                    
                    console.log(`Token ${tokenCount}: "${content.substring(0, 20)}..."`);
                    
                    // Send token immediately to frontend
                    res.write(`data: ${JSON.stringify({content: content})}\n\n`);
                  }
                } catch (error) {
                  console.error('Error in tokenCallback:', error);
                }
              },
              stream: true,
              systemType: this.systemType
            };
            
            // Add openai/deepinfra flags if needed
            if (config.openai_token) {
              chatConfig.openai = true;
            } else if (config.deepinfra_token) {
              chatConfig.deepinfra = true;
            }
            
            const result = await this.AI.Chat(messagesForAI, chatConfig);

            console.log(`AI.Chat completed. Total tokens: ${tokenCount}`);
            console.log('Result object:', result);

            // After streaming completes, store ONLY the clean text response
            // Use fullResponse if we accumulated tokens, otherwise fallback to result.full_text
            const finalResponse = fullResponse || (result?.full_text || '');
            
            if (finalResponse) {
              console.log('Storing final response:', finalResponse.substring(0, 50) + '...');
              // Add to both storage formats
              this.Chat.NewMessage('AI: ', finalResponse);
              this.messages.push({ role: 'assistant', content: finalResponse });
            } else {
              console.log('No final response to store!');
            }
            
            res.write('data: [DONE]\n\n');
            console.log('Stream completed');
            res.end();
          } catch (error) {
            console.error('Error processing message:', error);
            res.writeHead(500);
            res.end(JSON.stringify({error: 'Internal server error'}));
          }
        });
      } else if (req.method === 'POST' && req.url === '/reset') {
        this.Chat.Reset();
        this.messages = []; // Also reset the messages array
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'reset' }));
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    EasyAI_WebGPT.instance = this;
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
    const timestamp = Date.now();
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const uniqueFileName = `pm2_webgpt_${timestamp}_${randomSuffix}.mjs`;
    const serverScriptPath = path.join('/tmp', uniqueFileName);

    const currentModulePath = path.dirname(fileURLToPath(import.meta.url));
    const easyAIServerPath = pathToFileURL(path.join(currentModulePath, '../EasyAI.js')).href;

    const fileContent = `import EasyAI from '${easyAIServerPath}';
const config = ${JSON.stringify(config)};
const server = new EasyAI.WebGPT(config);
server.start()`
    writeFileSync(serverScriptPath, fileContent);

    try {
      await execAsync(`pm2 start ${serverScriptPath}`);
      console.log("PM2 process successfully managed.");
      return uniqueFileName.slice(0,uniqueFileName.length-4);;
    } catch (error) {
      console.error("PM2 error:", error.message);
      return false;
    }
  }

  async start() {
    if(this.handle_port){
        this.port = await FreePort(this.port);
    }
    this.server.listen(this.port, () => {
        const primaryIP = this.getPrimaryIP();
        console.log(`EasyAI server is running on http://${primaryIP}:${this.port}`);
    });
  }
}

export default EasyAI_WebGPT;