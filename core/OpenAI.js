import https from 'https';

class OpenAI {
    constructor(apiToken, config = {}) {
        this.apiToken = apiToken;
        this.config = config;
        this.model = config.model || undefined
    }

 /**
     * Generates text based on a given prompt using the OpenAI API.
     * 
     * @param {string} prompt - The input prompt for text generation. Defaults to 'Once upon a time'.
     * @param {Object} config - Configuration options for text generation.
     * @param {Function} config.tokenCallback - Optional. Callback function to receive streaming tokens.
     *                                          This function is called with an object containing the 
     *                                          'full_text' property for each chunk of generated text.
     * @param {number} config.max_tokens - Optional. Maximum number of tokens to generate. 
     *                                     Omit this parameter to use the default token limit.
     * 
     * @returns {Promise<Object>} A promise that resolves to an object containing the 'full_text' of 
     *                            the generated content.
     * 
     * Example Usage:
     * openai.Generate('Example prompt', {
     *     tokenCallback: (token) => { console.log(token.full_text); },
     *     max_tokens: 50
     * }).then(result => console.log('Final Result:', result));
     */

 async Generate(prompt = 'Once upon a time', config = {}) {
    config.max_tokens = config.max_tokens || 500
    return new Promise((resolve, reject) => {
        const data = {
            model: "gpt-3.5-turbo-instruct",
            prompt: prompt,
            stream: !!config.tokenCallback,
            ...(config.max_tokens && {max_tokens: config.max_tokens}),
            ...(config.stop && {stop: config.stop})
        };

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiToken}`
            }
        };

        let fullResponse = '';
        let buffer = '';

        const req = https.request(options, res => {
            res.on('data', d => {
                if (config.tokenCallback) {
                    // Handle data for streamed responses
                    buffer += d.toString();
                    let newlineIndex = buffer.indexOf('\n');
                    while (newlineIndex !== -1) {
                        let line = buffer.substring(0, newlineIndex);
                        buffer = buffer.substring(newlineIndex + 1);
                        newlineIndex = buffer.indexOf('\n');

                        line = line.replace(/^data: /, '');

                        if (line.trim()) {
                            try {
                                const response = JSON.parse(line);
                                if (response.choices && response.choices.length > 0) {
                                    const text = response.choices[0].text;
                                    fullResponse += text;
                                    config.tokenCallback({ 
                                        full_text: fullResponse,
                                        stream : {content : text}
                                    });
                                }
                            } catch (error) {
                                // Ignore parsing errors for streamed responses
                                //console.warn(`Ignoring non-JSON or incomplete JSON line: ${line}`);
                            }
                        }
                    }
                } else {
                    // Accumulate data for non-streamed responses
                    fullResponse += d.toString();
                }
            });

            res.on('end', () => {
                if (!config.tokenCallback) {
                    // Parse and handle non-streamed response
                    try {
                        const parsedResponse = JSON.parse(fullResponse);
                        const fullText = parsedResponse.choices.map(choice => choice.text).join('');
                        resolve({ full_text: fullText });
                    } catch (error) {
                        reject(`Error parsing JSON: ${error.message}`);
                    }
                } else {
                    // Resolve with the full text for streamed responses
                    resolve({ full_text: fullResponse });
                }
            });
        });

        req.on('error', error => {
            reject(error);
        });

        req.write(JSON.stringify(data));
        req.end();
    });
}

async Chat(messages = [{role : 'user',content : 'Who won the world series in 2020?'}], config = {}) {
    config.max_tokens = config.max_tokens || 500
    config.model = config.model || 'gpt-3.5-turbo'
    return new Promise((resolve, reject) => {
        const data = {
            model: config.model,
            messages : messages,
            stream: !!config.tokenCallback,
            ...(config.max_tokens && {max_tokens: config.max_tokens}),
            ...(config.stop && {stop: config.stop})
        };

        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiToken}`
            }
        };

        let fullResponse = '';
        let buffer = '';

        const req = https.request(options, res => {
            res.on('data', d => {
                if (config.tokenCallback) {
                    // Handle data for streamed responses
                    buffer += d.toString();
                    let newlineIndex = buffer.indexOf('\n');
                    while (newlineIndex !== -1) {
                        let line = buffer.substring(0, newlineIndex);
                        buffer = buffer.substring(newlineIndex + 1);
                        newlineIndex = buffer.indexOf('\n');

                        line = line.replace(/^data: /, '');

                        if (line.trim()) {
                            try {
                                const response = JSON.parse(line);
                                if (response.choices && response.choices.length > 0) {
                                    const text = response.choices[0].delta.content
                                    fullResponse += text;
                                    config.tokenCallback({ 
                                        full_text: fullResponse,
                                        stream : {content : text}
                                    });
                                }
                            } catch (error) {
                                // Ignore parsing errors for streamed responses
                                //console.warn(`Ignoring non-JSON or incomplete JSON line: ${line}`);
                            }
                        }
                    }
                } else {
                    // Accumulate data for non-streamed responses
                    fullResponse += d.toString();
                }
            });

            res.on('end', () => {
                if (!config.tokenCallback) {
                    // Parse and handle non-streamed response
                    try {
                        const parsedResponse = JSON.parse(fullResponse);
                        const fullText = parsedResponse.choices[0].message.content
                        resolve({ full_text: fullText });
                    } catch (error) {
                        reject(`Error parsing JSON: ${error.message}`);
                    }
                } else {
                    // Resolve with the full text for streamed responses
                    resolve({ full_text: fullResponse });
                }
            });
        });

        req.on('error', error => {
            reject(error);
        });

        req.write(JSON.stringify(data));
        req.end();
    });
}

}

export default OpenAI

//const ai = new OpenAI('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')

//console.log(await ai.Chat([{role : 'user',content : 'Who is obama?'}],{model : 'gpt-4-turbo-preview',tokenCallback : (token) => {console.log(token)}}))
//console.log(await ai.Chat([{role : 'user',content : 'Who is obama?'}]))