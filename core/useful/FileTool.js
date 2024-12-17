import fs from 'fs';
import path from 'path';

class FileTool {
  /**
   * Get the name of the file without the extension.
   * @param {string} filePath - The path to the file.
   * @returns {string} The name of the file without the extension.
   */
  static fileName(filePath) {
    const fileName = path.basename(filePath);
    const nameWithoutExtension = path.parse(fileName).name;
    return nameWithoutExtension;
  }

  /**
   * Get the size of the file in GB.
   * @param {string} filePath - The path to the file.
   * @param {object} config - Configuration object.
   * @param {boolean} config.includeUnit - Whether to include the unit (GB) in the output.
   * @returns {number|string} The size of the file in GB.
   */
  static fileSize(filePath, config = { includeUnit: false }) {
    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    const fileSizeInGB = fileSizeInBytes / (1024 ** 3);

    if (config.includeUnit) {
      return `${fileSizeInGB.toFixed(2)} GB`;
    }

    return fileSizeInGB;
  }
}

export default FileTool;