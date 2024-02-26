import { existsSync, rmdirSync, createWriteStream } from 'fs';
import { exec } from 'child_process';
import { join } from 'path';
import https from 'https';
import { pipeline } from 'stream';
import { promisify } from 'util';

const execAsync = promisify(exec);

class LlamacppRepo {
  static llamaCPPDir = join(process.cwd(), 'llama.cpp');
  static llamaCPPGitUrl = 'https://github.com/ggerganov/llama.cpp.git';

  static async cloneRepository() {
    try {
      await execAsync(`git clone ${this.llamaCPPGitUrl} "${this.llamaCPPDir}"`);
      console.log('llama.cpp repository cloned successfully!');
    } catch (error) {
      console.error('Failed to clone the llama.cpp repository:', error);
    }
  }

  static async resetRepository() {
    if (this.directoryExists()) {
      try {
        rmdirSync(this.llamaCPPDir, { recursive: true });
        await this.cloneRepository();
      } catch (error) {
        console.error('Failed to reset the llama.cpp repository:', error);
      }
    } else {
      await this.cloneRepository();
    }
  }

  static directoryExists() {
    return existsSync(this.llamaCPPDir);
  }

  static async changeHeadToCommit(commitHash) {
    if (this.directoryExists()) {
      try {
        await execAsync(`cd "${this.llamaCPPDir}" && git checkout ${commitHash}`);
        console.log(`HEAD changed to commit ${commitHash} successfully!`);
      } catch (error) {
        console.error(`Failed to change HEAD to commit ${commitHash}:`, error);
      }
    } else {
      console.error('Repository does not exist. Cannot change HEAD to commit.');
    }
  }

  static async downloadRepoFromLink(downloadLink) {
    const file = join(this.llamaCPPDir, 'download.zip'); // Assuming the link is a zip file
    https.get(downloadLink, response => {
      pipeline(response, createWriteStream(file), (err) => {
        if (err) {
          console.error('Failed to download the repository:', err);
        } else {
          console.log('Repository downloaded successfully!');
          // Here, you would extract the zip and perform any necessary setup
        }
      });
    });
  }
}

export default LlamacppRepo;
