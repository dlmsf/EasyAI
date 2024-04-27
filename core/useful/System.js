import os from 'os';

function System() {
  const platform = os.platform();

  if (platform.startsWith('win')) {
    return 'windows';
  } else if (platform === 'linux') {
    return 'linux';
  } else {
    return 'unknown';
  }
}

export default System