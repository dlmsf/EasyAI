import fs from 'fs';

async function CheckFile(filePath) {
  try {
    // fs.promises.stat throws an error if the file does not exist
    await fs.promises.stat(filePath);
    return true;  // The file exists
  } catch (error) {
    if (error.code === 'ENOENT') {  // 'ENOENT' means no such file or directory
      return false;  // The file does not exist
    }
    throw error;  // Re-throw other errors (e.g., permission issues)
  }
}

export default CheckFile