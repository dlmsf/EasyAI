import http from 'http';

// Function to consume the /generate route
function consumeGenerateRoute({
  serverUrl,
  port,
  prompt,
  token = '', // Optional token, default to an empty string if not provided
  config = {},
  onData = () => {}
}) {
  return new Promise((resolve, reject) => {
    // Merge user-provided config with defaults
    const finalConfig = {
      stream: true,
      retryLimit: 60000,
      ...config
    };

    // Prepare the request data with the optional token included only if provided
    const requestData = {
      prompt,
      ...(token && { token }), // Spread token only if it's truthy
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
      }
    };

    // Create the POST request to the server
    const req = http.request(options, (res) => {
      let finalData = '';

      // Handle the stream of data
      res.on('data', (chunk) => {
        const chunkData = chunk.toString();
        try {
          const parsedChunk = JSON.parse(chunkData);
          onData(parsedChunk); // Invoke the callback with the parsed chunk
        } catch (error) {
          // Accumulate non-JSON chunks (possible final data)
          finalData += chunkData;
        }
      });

      res.on('end', () => {
        try {
          // Attempt to parse and resolve the final data
          resolve(JSON.parse(finalData));
        } catch (error) {
          // Resolve with the raw data if JSON parsing fails
          resolve(finalData);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    // Send the request with the post data
    req.write(postData);
    req.end();
  });
}

// Export the function
export default consumeGenerateRoute;

/*
// Example usage
const serverUrl = 'ip-of-server'; // Replace with your server's IP
const port = 4000; // Replace with your server's port
const prompt = 'the text below is a very little motivacional message';

console.log(await consumeGenerateRoute({serverUrl : serverUrl,port : port,prompt : prompt,onData : (token) => console.log(token)}))
*/
