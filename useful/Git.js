import { spawn } from 'child_process';

class Git {
  static executeGitCommand(args, path) {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, { cwd: path });
      let output = '';
      gitProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      gitProcess.stderr.on('data', (data) => {
        reject(data.toString());
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(`Git process exited with code ${code}`);
        }
      });
    });
  }

  static async Checkout(path, hash) {
    try {
      return await this.executeGitCommand(['checkout', hash], path);
    } catch (error) {
      console.error('Checkout failed:', error);
      return
    }
  }

  static async ActualHash(path) {
    try {
      return await this.executeGitCommand(['rev-parse', 'HEAD'], path);
    } catch (error) {
      console.error('Failed to get actual hash:', error);
      throw error;
    }
  }
}

export default Git;
