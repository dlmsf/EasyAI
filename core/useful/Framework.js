import { promises as fs } from 'fs';
import path from 'path';

/**
 * Check if a file or directory should be ignored based on the config
 * @param {string} relativeFilePath - The relative path of the file.
 * @param {Object} config - The configuration object.
 * @param {string[]} [config.ignore] - Array of file paths to ignore.
 * @param {string[]} [config.ignoreStartsWith] - Array of prefixes to ignore files that start with them.
 * @returns {boolean} - Returns true if the file should be ignored.
 */
function shouldIgnore(relativeFilePath, config) {
    if (config.ignore && config.ignore.includes(relativeFilePath)) {
        return true;
    }
    if (config.ignoreStartsWith) {
        return config.ignoreStartsWith.some(prefix => relativeFilePath.startsWith(prefix));
    }
    return false;
}

/**
 * Recursively reads files from a directory, considering ignore rules.
 * @param {string} directory - The directory path.
 * @param {string} baseFolder - The base folder path for relative calculations.
 * @param {Object} config - The configuration object.
 * @param {string[]} output - The output array to accumulate file contents.
 */
async function readFiles(directory, baseFolder, config, output) {
    const files = await fs.readdir(directory);

    for (const file of files) {
        const relativeFilePath = path.relative(baseFolder, path.join(directory, file));

        if (shouldIgnore(relativeFilePath, config)) {
            continue;
        }

        const filePath = path.join(directory, file);
        const fileStat = await fs.stat(filePath);

        if (fileStat.isDirectory()) {
            await readFiles(filePath, baseFolder, config, output);
        } else {
            const content = await fs.readFile(filePath, 'utf8');
            output.push(`//${relativeFilePath}\n${content}\n`);
        }
    }
}

/**
 * Reads files from the given folder path, ignoring specified files.
 * @param {string} folderPath - The path to the folder.
 * @param {Object} config - The configuration object.
 * @param {string[]} [config.ignore] - Array of file paths to ignore.
 * @param {string[]} [config.ignoreStartsWith] - Array of prefixes to ignore files that start with them.
 * @returns {Promise<string>} - A promise that resolves to the concatenated file contents.
 */
async function Framework(folderPath, config = {}) {
    let output = [];

    try {
        await readFiles(folderPath, folderPath, config, output);
    } catch (error) {
        console.error('Error reading folder:', error);
        return ''; // Return an empty string in case of an error
    }

    return output.join('\n').trim();
}

export default Framework;
