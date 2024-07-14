import fs from 'fs';
import path from 'path';

const Dos2Unix = (filePath) => {
  if (fs.lstatSync(filePath).isDirectory()) {
    // If the path is a directory, iterate over all files in the directory
    fs.readdirSync(filePath).forEach((file) => {
      const fileWithPath = path.join(filePath, file);
      const fileContent = fs.readFileSync(fileWithPath, 'utf8');
      const fixedContent = fileContent.replace(/\r\n/g, '\n');
      fs.writeFileSync(fileWithPath, fixedContent);
    });
  } else {
    // If the path is a file, apply the correction to the single file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const fixedContent = fileContent.replace(/\r\n/g, '\n');
    fs.writeFileSync(filePath, fixedContent);
  }
};

export default Dos2Unix;