import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import net from 'net';
import ConfigManager from './ConfigManager.js';

class LogMaster {
    static logFilePath = path.join(process.cwd(), 'log.json');
    static tempLogFilePath = path.join(process.cwd(), 'templog.json');
    static hudSocketPath = process.platform === 'win32' ? '\\\\.\\pipe\\logmaster' : '/tmp/logmaster.sock';
    static eventEmitter = new EventEmitter();
    static isWatching = false;
    static activeTypeFilter = null; // For filtering logs in real-time
    static socket = null; // To keep track of the socket

    static ensureLogFileExists() {
        if (!fs.existsSync(this.logFilePath)) {
            fs.writeFileSync(this.logFilePath, '[]', 'utf-8');
        }
    }

    static Log(type, eventContent) {
        const timestamp = Date.now();
        const date = new Date(timestamp).toLocaleString('pt-BR', {
            timeZone: 'UTC',
            hour12: false,
        });
    
        const logEntry = {
            TimeStamp: timestamp,
            Date: date,
            Type: type,
            EventContent: eventContent,
        };
    
        // Write log to the socket if the HUD is active
        const writeToSocket = new Promise((resolve) => {
            const client = net.createConnection(this.hudSocketPath, () => {
                client.write(JSON.stringify(logEntry));
                client.end();
                resolve(true);
            });
    
            client.on('error', () => {
                // If socket logging fails, resolve without interrupting file logging
                resolve(false);
            });
        });
    
        // Always log to the file if ConfigManager allows it
        const writeToFile = () => {
            const shouldLog = ConfigManager.getKey('log');
            if (!shouldLog) return;
    
            this.ensureLogFileExists();
    
            let logs = [];
            if (fs.existsSync(this.logFilePath)) {
                logs = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'));
            }
    
            logs.push(logEntry);
            fs.writeFileSync(this.logFilePath, JSON.stringify(logs, null, 4), 'utf-8');
        };
    
        // Ensure both logging actions are performed
        writeToSocket.finally(() => {
            writeToFile();
        });
    }
    

    static startHUD() {
        if (fs.existsSync(this.hudSocketPath)) {
            fs.unlinkSync(this.hudSocketPath);
        }

        const server = net.createServer((socket) => {
            this.socket = socket; // Keep track of the socket
            socket.on('data', (data) => {
                const logEntry = JSON.parse(data.toString());
                if (this.isWatching) {
                    if (!this.activeTypeFilter || logEntry.Type === this.activeTypeFilter) {
                        this.displayLog(logEntry);
                    }
                }
            });
        });

        server.listen(this.hudSocketPath, () => {
            console.log('HUD watcher started. Listening for logs...');
            this.displayHUDMenu();
        });

        server.on('error', (err) => {
            console.error('Failed to start HUD watcher:', err);
        });

        process.on('exit', () => {
            if (fs.existsSync(this.hudSocketPath)) {
                fs.unlinkSync(this.hudSocketPath);
            }
        });

        process.on('SIGINT', () => process.exit());
        process.on('SIGTERM', () => process.exit());
    }

    static enterWatchMode() {
        console.clear();
        console.log('Entering Watch Mode. Press "q" to return to the main menu.');

        this.isWatching = true; // Enable log display
        const handleKeyPress = (chunk) => {
            if (chunk.trim() === 'q') {
                process.stdin.removeListener('data', handleKeyPress);
                this.isWatching = false; // Disable log display
                if (this.socket) {
                    this.socket.removeAllListeners('data'); // Stop listening for data
                }
                this.displayHUDMenu();
            }
        };

        process.stdin.on('data', handleKeyPress);
    }

    static displayHUDMenu() {
        console.clear();
        console.log('LogMaster HUD Menu');
        console.log('1. View all log types');
        console.log('2. Search logs by term');
        console.log('3. Set real-time filter by type');
        console.log('4. Clear real-time filter');
        console.log('5. Enter Watch Mode');
        console.log('6. Exit HUD');

        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        const handleMenuChoice = (input) => {
            const choice = input.trim();

            switch (choice) {
                case '1':
                    this.displayLogTypes();
                    break;
                case '2':
                    this.promptSearchTerm();
                    break;
                case '3':
                    this.promptSetFilter();
                    break;
                case '4':
                    this.clearFilter();
                    break;
                case '5':
                    this.enterWatchMode();
                    break;
                case '6':
                    process.exit();
                    break;
                default:
                    console.log('Invalid choice. Please select a valid option.');
                    this.displayHUDMenu();
            }
        };

        process.stdin.once('data', handleMenuChoice);
    }

    static displayLogTypes() {
        this.ensureLogFileExists();
        const logs = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'));
        const types = [...new Set(logs.map(log => log.Type))];

        console.log('Available Log Types:');
        types.forEach((type, index) => {
            console.log(`${index + 1}. ${type}`);
        });

        console.log('Select a type by number to view logs or press Enter to return to menu.');

        const handleTypeSelection = (input) => {
            const choice = parseInt(input.trim(), 10);

            if (choice >= 1 && choice <= types.length) {
                const selectedType = types[choice - 1];
                const filteredLogs = logs.filter(log => log.Type === selectedType);
                console.log(`Logs of type "${selectedType}":`, filteredLogs);
            } else {
                console.log('Invalid choice. Returning to menu.');
                this.displayHUDMenu();
                return;
            }

            console.log('Press any key to return to the main menu.');
            process.stdin.once('data', () => this.displayHUDMenu());
        };

        process.stdin.once('data', handleTypeSelection);
    }

    static promptSearchTerm() {
        console.log('Enter a search term:');

        const handleSearchTerm = (input) => {
            const searchTerm = input.trim();
            this.ensureLogFileExists();

            const logs = JSON.parse(fs.readFileSync(this.logFilePath, 'utf-8'));
            const filteredLogs = logs.filter(log => JSON.stringify(log).includes(searchTerm));

            console.log(`Logs containing "${searchTerm}":`, filteredLogs);

            console.log('Press any key to return to the main menu.');
            process.stdin.once('data', () => this.displayHUDMenu());
        };

        process.stdin.once('data', handleSearchTerm);
    }

    static promptSetFilter() {
        console.log('Enter the type to filter by in real-time:');

        const handleSetFilter = (input) => {
            this.activeTypeFilter = input.trim();
            console.log(`Real-time filter set to type "${this.activeTypeFilter}".`);
            this.displayHUDMenu();
        };

        process.stdin.once('data', handleSetFilter);
    }

    static clearFilter() {
        this.activeTypeFilter = null;
        console.log('Real-time filter cleared. Displaying all logs.');
        this.displayHUDMenu();
    }

    static displayLog(logEntry) {
        const boxLines = [
            '┌────────────────────────────────────────────────────────┐',
            `│ Date: ${logEntry.Date.padEnd(47)} │`,
            `│ Type: ${logEntry.Type.padEnd(47)} │`,
            '├────────────────────────────────────────────────────────┤',
        ];

        const simplifiedContent = this.simplifyContent(logEntry.EventContent);
        Object.entries(simplifiedContent).forEach(([key, value]) => {
            const line = `│ ${key}: ${String(value).slice(0, 40).padEnd(40)} │`;
            boxLines.push(line);
        });

        boxLines.push('└────────────────────────────────────────────────────────┘');
        console.log(boxLines.join('\n'));
    }

    static simplifyContent(content) {
        if (typeof content === 'object' && content !== null) {
            if (Array.isArray(content)) {
                return '[ARRAY]';
            } else {
                // Simplify objects to show key-value pairs, limited to a reasonable size
                const simplified = {};
                for (const [key, value] of Object.entries(content)) {
                    if (typeof value === 'object') {
                        simplified[key] = '[OBJECT]';
                    } else {
                        simplified[key] = String(value).slice(0, 30); // Truncate long strings
                    }
                }
                return simplified;
            }
        } else if (typeof content === 'string') {
            return content.slice(0, 50) + (content.length > 50 ? '...' : ''); // Truncate if too long
        } else {
            return String(content);
        }
    }
}

export default LogMaster;
