import net from 'net';

/**
 * Finds the next available network port starting from specified number
 * @param {number} [start=3000] - Port number to begin checking
 * @returns {Promise<number>} First available port found
 * @throws {Error} If no ports are available (after start through 65535)
 */
export async function FreePort(start = 3000) {
  for (let port = start; port < 65536; port++) {
    if (await available(port)) return port;
  }
  throw new Error('No available ports found');
}

/**
 * Checks if a specific port is currently available
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if port is available
 * @private
 */
function available(port) {
  return new Promise((resolve) => {
    const test = net.createServer();
    test.once('error', () => {
      test.close(() => resolve(false));
    });
    test.once('listening', () => {
      test.close(() => resolve(true));
    });
    test.listen(port);
  });
}

export default FreePort