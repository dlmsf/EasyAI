import fs from 'fs';
import path from 'path';

class ModelSearch {
    static config = {
        log: false,
        unique: true,
        orderBySize: 'desc', // 'desc' or 'asc'
        fastMode: false,
        startPath: null
    };

    static GGUF(userConfig = {}) {
        // Merge user config with defaults
        const config = { ...this.config, ...userConfig };
        
        const startTime = Date.now();
        const results = [];
        const foundModels = new Set();

        // Common directories to skip for performance
        const defaultSkipDirs = new Set([
            'node_modules', '.git', '.vscode', '.idea', 'temp', 'tmp',
            'cache', 'logs', 'build', 'dist', 'out', 'bin', 'obj',
            'vendor', 'packages', 'Library', 'System', 'Applications',
            'Windows', 'Program Files', 'Program Files (x86)', 'ProgramData'
        ]);

        // Additional directories to skip in fast mode
        const fastModeSkipDirs = new Set([
            'Downloads', 'Documents', 'Pictures', 'Music', 'Movies',
            'Videos', 'Desktop', 'Public', 'Dropbox', 'Google Drive',
            'OneDrive', 'iCloud', 'Backups', 'Time Machine.backup',
            '.Trash', 'Recycle Bin', '$Recycle.Bin', 'AppData',
            'Local Settings', 'Application Data'
        ]);

        function shouldSkipDirectory(dirName) {
            if (defaultSkipDirs.has(dirName)) return true;
            if (config.fastMode && fastModeSkipDirs.has(dirName)) return true;
            
            // Skip hidden directories (except those starting with .config or similar)
            if (dirName.startsWith('.') && !['.config', '.local', '.cache'].includes(dirName)) {
                return true;
            }
            
            return false;
        }

        function searchDirectory(currentPath) {
            try {
                const items = fs.readdirSync(currentPath, { withFileTypes: true });
                
                for (const item of items) {
                    const fullPath = path.join(currentPath, item.name);
                    
                    if (item.isDirectory()) {
                        // Skip directories based on configuration
                        if (shouldSkipDirectory(item.name)) {
                            continue;
                        }
                        
                        // Recursively search the directory
                        searchDirectory(fullPath);
                    } else if (item.isFile() && item.name.endsWith('.gguf')) {
                        const modelName = item.name.replace('.gguf', '');
                        
                        // Skip duplicates if unique is true
                        if (config.unique && foundModels.has(modelName)) {
                            continue;
                        }
                        
                        try {
                            const stats = fs.statSync(fullPath);
                            const sizeInGB = parseFloat((stats.size / (1024 * 1024 * 1024)).toFixed(2));
                            
                            results.push({
                                model: modelName,
                                path: fullPath,
                                size: sizeInGB
                            });
                            
                            foundModels.add(modelName);
                        } catch (error) {
                            // Skip files that can't be accessed
                            continue;
                        }
                    }
                }
            } catch (error) {
                // Skip directories that can't be accessed
                return;
            }
        }

        // Determine starting directory
        let startDir;
        if (config.startPath && fs.existsSync(config.startPath)) {
            startDir = path.resolve(config.startPath);
        } else {
            startDir = process.platform === 'win32' ? 'C:\\' : '/';
        }

        // Start search
        searchDirectory(startDir);

        // Sort results by size
        if (config.orderBySize === 'desc') {
            results.sort((a, b) => b.size - a.size);
        } else if (config.orderBySize === 'asc') {
            results.sort((a, b) => a.size - b.size);
        }

        if (config.log) {
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            console.log(`ModelSearch completed in ${executionTime}ms. Found ${results.length} models.`);
            console.log(`Search started from: ${startDir}`);
            console.log(`Fast mode: ${config.fastMode ? 'enabled' : 'disabled'}`);
        }

        return results;
    }
}

export default ModelSearch