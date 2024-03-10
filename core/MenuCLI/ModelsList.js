import fs from 'fs/promises';
import path from 'path';

async function ModelsList() {
    try {
        const modelsDir = path.join(process.cwd(), 'models');
        const files = await fs.readdir(modelsDir, { withFileTypes: true });
        const modelDetails = await Promise.all(
            files
                .filter(dirent => dirent.isFile())
                .map(async (dirent) => {
                    const filePath = path.join(modelsDir, dirent.name);
                    const stats = await fs.stat(filePath);
                    const sizeInGigabytes = stats.size / (1024 ** 3); // Convert bytes to gigabytes
                    return {
                        name: dirent.name,
                        size: Number(sizeInGigabytes.toFixed(2)), // Format to 2 decimal places
                    };
                })
        );
        return modelDetails;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return [];
        } else {
            throw err;
        }
    }
}

export default ModelsList;
