import http from 'http';
import crypto from 'crypto';

class WebSocket {
    constructor(port) {
        this.connections = [];
        this.server = http.createServer((req, res) => {
            res.writeHead(404);
            res.end();
        });

        this.server.on('upgrade', (req, socket, head) => {
            this.handleUpgrade(req, socket, head);
        });

        this.server.listen(port, () => {
            console.log(`Server listening on port ${port}`);
        });

        this.server.on('error', (err) => {
            console.error('Server error:', err);
        });
    }

    handleUpgrade(req, socket, head) {
        if (req.headers['upgrade'] !== 'websocket') {
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
            socket.destroy();
            return;
        }

        const acceptKey = req.headers['sec-websocket-key'];
        const hash = this.generateAcceptValue(acceptKey);
        const responseHeaders = [
            'HTTP/1.1 101 Web Socket Protocol Handshake',
            'Upgrade: WebSocket',
            'Connection: Upgrade',
            `Sec-WebSocket-Accept: ${hash}`
        ];

        socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
        this.setupConnection(socket);
    }

    generateAcceptValue(acceptKey) {
        return crypto
            .createHash('sha1')
            .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
            .digest('base64');
    }

    setupConnection(socket) {
        this.connections.push(socket);
        socket.on('data', (data) => {
            this.handleMessage(socket, data);
        });
        socket.on('error', (err) => {
            console.error('Socket error:', err);
            this.connections = this.connections.filter(s => s !== socket);
            socket.destroy();
        });
        socket.on('close', () => {
            this.connections = this.connections.filter(s => s !== socket);
        });
    }

    handleMessage(socket, data) {
        const message = this.parseMessage(data);
        if (message) {
            console.log('Message from client:', message);
            this.sendMessage(socket, message);  // Echo the message back to the client
        } else {
            console.log('Invalid message');
        }
    }

    sendMessage(socket, message) {
        const buffer = Buffer.from(message);
        const frame = Buffer.concat([
            Buffer.from([0x81, buffer.length]), // Assuming payload is less than 126
            buffer
        ]);
        socket.write(frame);
    }

    parseMessage(data) {
        let payload = data.slice(2); // Strip off fin and opcode
        const mask = payload.slice(0, 4); // Get mask
        payload = payload.slice(4); // Adjust to get payload
        for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4]; // Unmask payload
        }
        return payload.toString();
    }
}

export default WebSocket