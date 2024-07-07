import os from 'os';
import fs from 'fs';
import childProcess from 'child_process';

function System(detectLinuxDistribution = false) {
  const platform = os.platform();

  if (platform.startsWith('win')) {
    return 'windows';
  } else if (platform === 'linux') {
    if (detectLinuxDistribution) {
      try {
        const release = fs.readFileSync('/etc/os-release', 'utf8');
        const ubuntuRegex = /ubuntu/i;
        const centosRegex = /centos/i;

        if (ubuntuRegex.test(release)) {
          return 'ubuntu';
        } else if (centosRegex.test(release)) {
          return 'centos';
        } else {
          return 'unknown linux distribution';
        }
      } catch (error) {
        // Fallback to using lsb-release command (Ubuntu-based distributions only)
        const lsbRelease = childProcess.spawnSync('lsb_release', ['-a']);
        const output = lsbRelease.stdout.toString();
        const ubuntuRegex = /ubuntu/i;

        if (ubuntuRegex.test(output)) {
          return 'ubuntu';
        } else {
          return 'unknown linux distribution';
        }
      }
    } else {
      return 'linux';
    }
  } else {
    return 'unknown';
  }
}

export default System;