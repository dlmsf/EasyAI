import http from 'http';
import https from 'https';

/**
 * Utility function to consume the /generate route of EasyAI Server
 * @param {Object} params - Function parameters
 * @param {string} params.serverUrl - Server URL or IP address
 * @param {number} params.port - Server port
 * @param {string} params.prompt - Prompt for generation
 * @param {string} params.token - Authentication token (optional)
 * @param {Object} params.config - Configuration object (optional)
 * @param {Function} params.onData - Callback for streaming data (optional)
 * @returns {Promise<Object>} - Promise resolving to the response data with stream log
 */

// Default error message tokens for streaming
const DEFAULT_ERROR_TOKENS = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
const DEFAULT_ERROR_TEXT = "Sorry, I'm unable to respond at the moment.";

// verificação se é um IP
function isIpAddress(serverUrl) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(serverUrl);
}

function consumeGenerateRoute({
  serverUrl,
  port,
  prompt,
  token = '',
  config = {},
  onData = () => {}
}) {
  return new Promise(async (resolve) => {
    const maxRetryTime = 30000;
    const retryDelay = 500;
    const startTime = Date.now();
    
    let lastError = null;
    let activeRequest = null;
    let consecutiveTimeouts = 0;
    
    // Array to store all streamed tokens
    const streamLog = [];
    
    // Wrapper for onData to also capture in streamLog
    const wrappedOnData = (data) => {
      // Call the original onData
      onData(data);
      // Capture in streamLog
      streamLog.push(data);
    };
    
    const cleanup = () => {
      activeRequest = null;
    };
    
    // Check if streaming is enabled
    const isStreaming = config.stream === true && typeof onData === 'function';
    
    while (Date.now() - startTime < maxRetryTime) {
      try {
        activeRequest = attemptRequest({
          serverUrl,
          port,
          prompt,
          token,
          config,
          onData: wrappedOnData
        });
        
        const result = await activeRequest;
        cleanup();
        
        // FIX: Handle both object and string results
        let finalResult = result;
        
        // If result is a string, convert it to an object with full_text property
        if (typeof result === 'string') {
          finalResult = { full_text: result };
        }
        
        // Add streamLog to the result (only if it's an object)
        if (isStreaming && typeof finalResult === 'object' && finalResult !== null) {
          finalResult.streamLog = streamLog;
        }
        
        resolve(finalResult);
        return;
        
      } catch (error) {
        cleanup();
        lastError = error;
        
        if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
          consecutiveTimeouts++;
        } else {
          consecutiveTimeouts = 0;
        }
        
        if (!isConnectionError(error)) {
          break;
        }
        
        if (Date.now() - startTime < maxRetryTime - retryDelay) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // Handle error case
    if (isStreaming) {
      await streamDefaultErrorMessage(wrappedOnData, config);
      
      // FIX: Return a proper object even in error case
      resolve({ 
        error: lastError?.message || "server offline",
        full_text: DEFAULT_ERROR_TEXT,
        streamLog: streamLog
      });
    } else {
      resolve({ 
        error: lastError?.message || "server offline" 
      });
    }
  });
}

// Helper function to stream default error message
async function streamDefaultErrorMessage(onData, config) {
  return new Promise((resolve) => {
    let i = 0;
    
    function streamNext() {
      if (i < DEFAULT_ERROR_TOKENS.length) {
        onData({
          stream: {
            content: DEFAULT_ERROR_TOKENS[i]
          }
        });
        i++;
        setTimeout(streamNext, 45);
      } else {
        resolve();
      }
    }
    
    streamNext();
  });
}

function isConnectionError(error) {
  return error.code === 'ECONNREFUSED' || 
         error.code === 'ETIMEDOUT' || 
         error.code === 'ENOTFOUND' ||
         error.code === 'ECONNRESET' ||
         error.code === 'EAI_AGAIN' ||
         error.code === 'EHOSTUNREACH' ||
         error.code === 'ENETUNREACH' ||
         error.message?.includes('connect') ||
         error.message?.includes('connection') ||
         error.message?.includes('timeout') ||
         error.message?.includes('network') ||
         error.message?.includes('ECONNREFUSED') ||
         error.message?.includes('ETIMEDOUT');
}

function attemptRequest({
  serverUrl,
  port,
  prompt,
  token = '',
  config = {},
  onData = () => {}
}) {
  return new Promise((resolve, reject) => {
    let isIp = undefined;

    if(serverUrl != 'localhost'){
      isIp = isIpAddress(serverUrl);
    } else {
      isIp = true;
    }

    const protocol = isIp ? http : https;

    if (isIp && !port) {
      port = 80;
    }

    if (!isIp) {
      port = 443;
    }

    const finalConfig = config;

    const requestData = {
      prompt,
      ...(token && { token }),
      config: finalConfig
    };

    const postData = JSON.stringify(requestData);

    const options = {
      hostname: serverUrl,
      port,
      path: '/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = protocol.request(options, (res) => {
      let finalData = '';
      let hasResolved = false;

      res.on('data', (chunk) => {
        const chunkData = chunk.toString();
        try {
          const parsedChunk = JSON.parse(chunkData);
          
          // FIX: Handle the streaming logic better
          if (parsedChunk.stream && config.stream) {
            // This is a streaming token - pass it to onData
            onData(parsedChunk);
          } else if (!config.stream || parsedChunk.generation_settings) {
            // This is the final result (non-streaming or metadata)
            if (!hasResolved) {
              hasResolved = true;
              resolve(parsedChunk);
            }
          }
        } catch (error) {
          // If it's not JSON and streaming is enabled, might be raw content
          finalData += chunkData;
        }
      });

      res.on('end', () => {
        if (!hasResolved) {
          try {
            // Try to parse as JSON first
            resolve(JSON.parse(finalData));
          } catch (error) {
            // If it's not JSON, return as string
            resolve(finalData);
          }
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(postData);
    req.end();
  });
}

export default consumeGenerateRoute;