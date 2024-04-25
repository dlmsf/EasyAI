import fs from 'fs'
import path from 'path'

async function findDirectory(startPath, folderName) {
    let foundPath = null;

    if (!fs.existsSync(startPath)) {
        console.log("No directory:", startPath);
        return;
    }

    const files = fs.readdirSync(startPath);

    for (let i = 0; i < files.length; i++) {
        const filename = path.join(startPath, files[i]);
        const stat = fs.lstatSync(filename);

        if (stat.isDirectory()) {
            if (filename.endsWith(path.sep + folderName)) {
                return filename;
            }

            foundPath = await findDirectory(filename, folderName);
            if (foundPath) return foundPath;
        }
    }
}

export default findDirectory