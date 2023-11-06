import http from 'http';
import https from 'https';

//Função utlitaria de consumo da rota /generate do EasyAI Server

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
  return new Promise((resolve, reject) => {

    const isIp = isIpAddress(serverUrl);

    const protocol = isIp ? http : https;

    if (isIp && !port) {
      port = 80;
    }

    if (!isIp) {
      port = 443;
    }

    const finalConfig = {
      stream: true,
      retryLimit: 60000,
      ...config
    };

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
      }
    };

    const req = protocol.request(options, (res) => {
      let finalData = '';

      res.on('data', (chunk) => {
        const chunkData = chunk.toString();
        try {
          const parsedChunk = JSON.parse(chunkData);
          onData(parsedChunk);
        } catch (error) {
          finalData += chunkData;
        }
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(finalData));
        } catch (error) {
          resolve(finalData);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

export default consumeGenerateRoute;
