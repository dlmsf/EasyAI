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
    const maxRetryTime = 30000; // Increased to 30 seconds total retry time
    const retryDelay = 500; // Reduced to 500ms between retries for faster recovery
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
        // Ensure only one request is active at a time
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
        
        // Add streamLog to the result
        if (isStreaming) {
          result.streamLog = streamLog;
        }
        
        // Success! Resolve with the result
        resolve(result);
        return;
        
      } catch (error) {
        cleanup();
        lastError = error;
        
        // Track consecutive timeouts to detect pattern
        if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
          consecutiveTimeouts++;
        } else {
          consecutiveTimeouts = 0;
        }
        
        // If it's not a connection error, don't retry (but still handle with error message)
        if (!isConnectionError(error)) {
          break;
        }
        
        // If we've had many consecutive timeouts, the server might be starting up
        // Keep retrying with small delays
        
        // Wait before retrying if we still have time
        if (Date.now() - startTime < maxRetryTime - retryDelay) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // If we get here, it means all retries failed
    // Handle the error by streaming default message if streaming is enabled
    
    if (isStreaming) {
      // Stream the default error message token by token and capture in streamLog
      await streamDefaultErrorMessage(wrappedOnData, config);
      
      // Resolve with the error object AND the streamLog after streaming completes
      resolve({ 
        error: lastError?.message || "server offline",
        full_text: DEFAULT_ERROR_TEXT,
        streamLog: streamLog  // Include the captured stream log
      });
    } else {
      // For non-streaming, just return the error object
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
        // Simulate streaming by calling onData with each token
        onData({
          stream: {
            content: DEFAULT_ERROR_TOKENS[i]
          }
        });
        i++;
        
        // Use a small delay between tokens to simulate real streaming
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
      timeout: 10000 // Reduced to 10 second timeout for faster failure detection
    };

    const req = protocol.request(options, (res) => {
      let finalData = '';
      let hasResolved = false;

      res.on('data', (chunk) => {
        const chunkData = chunk.toString();
        try {
          const parsedChunk = JSON.parse(chunkData);
          if(!config.stream || parsedChunk.generation_settings){
            if (!hasResolved) {
              hasResolved = true;
              resolve(parsedChunk);
            }
          } else {
            onData(parsedChunk);
          }
        } catch (error) {
          finalData += chunkData;
        }
      });

      res.on('end', () => {
        if (!hasResolved) {
          try {
            resolve(JSON.parse(finalData));
          } catch (error) {
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

/*
let final_response = await consumeGenerateRoute({
  serverUrl : 'localhost',
  port : 6000,
  prompt : 'once upon a time ',
  config : {stream : true},
  onData : (t) => {console.log(t)}
})

console.log(final_response)
*/
