import { readFileSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Find and return the version from package.json, searching upwards from current directory
 * @returns {string} Version string from package.json, or '0.0.0' if not found
 */
export default function getProjectVersion() {
    const MAX_LEVELS = 10;
    let currentDir = process.cwd();
    
    for (let level = 0; level < MAX_LEVELS; level++) {
        try {
            const packageJsonPath = join(currentDir, 'package.json');
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
            return packageJson.version || '0.0.0';
        } catch {
            const parentDir = dirname(currentDir);
            if (parentDir === currentDir) break;
            currentDir = parentDir;
        }
    }
    
    return '0.0.0';
}