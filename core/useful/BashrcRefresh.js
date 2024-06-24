import {spawn} from 'child_process'

const BashrcRefresh = async () => {
    const bashProcess = spawn('bash', ['-c', 'source ~/.bashrc && env']);

    let envOutput = '';
    bashProcess.stdout.on('data', (data) => {
        envOutput += data.toString();
    });

await new Promise((resolve) => {
        bashProcess.on('close', resolve);
    });

const envVars = envOutput.split('\n').reduce((acc, line) => {
        const [key, value] = line.split('=');
        acc[key] = value;
        return acc;
    }, {});

// Update the process environment with the new variables
Object.assign(process.env, envVars);

    //console.log('Environment variables refreshed!');

}

export default BashrcRefresh