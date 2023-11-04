import LlamaCPP from "./core/Llama/LlamaCPP.js"

class EasyAI {
    constructor(config = {llama_model : ''}){

        this.LlamaCPP = new LlamaCPP({modelpath : config.llama_model})

    }

async Generate(prompt = 'Once upon a time', config = { stream: false, retryLimit: 60000 }, tokenCallback = (token) => { }) {
        let attempts = 0;
        const startTime = Date.now();
        let lastLogTime = Date.now(); 
        const retryLimit = config.retryLimit !== undefined ? config.retryLimit : 60000;

        while ((Date.now() - startTime) < retryLimit) {
            const result = await this.LlamaCPP.Generate(prompt, config, tokenCallback);
            if (result !== false) {
                return result;
            }
            
            await EasyAI.Sleep(3000);
            
            attempts++;

            if ((Date.now() - lastLogTime) >= 40000 || attempts == 1) {
                console.log("Não foi possível executar o método Generate() | Tentando novamente...");
                lastLogTime = Date.now();
            }
        }

        throw new Error("Generate method failed: retry limit reached.");
    }

async Sleep(ms) {
    await EasyAI.Sleep(ms)
}

static ModelManager = {

}

static Sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

}

export default EasyAI