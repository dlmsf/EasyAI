import EasyAI_Server from "./core/EasyAI_Server.js";
import LlamaCPP from "./core/Llama/LlamaCPP.js"
import consumeGenerateRoute from "./useful/consumeGenerateRoute.js";

class EasyAI {
    constructor(config = {server_url : '',server_port : 4000,server_token : '',llama : {llama_model : '',gpu_layers : undefined}}){

        this.ServerURL = config.server_url || null
        this.ServerPORT = config.server_port || 4000
        this.ServerTOKEN = config.server_token || null

        if(!this.ServerURL){
            this.LlamaCPP = new LlamaCPP({modelpath : config.llama.llama_model,gpu_layers : config.llama.gpu_layers})
        }
    }

async Generate(prompt = 'Once upon a time', config = { stream: false, retryLimit: 60000 }, tokenCallback = (token) => { }) {

        if(this.ServerURL){

            return await consumeGenerateRoute({serverUrl : this.ServerURL,port : this.ServerPORT,prompt : prompt,token : this.ServerTOKEN,config : config,onData : tokenCallback})

        } else {

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

    }

static Sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

static Server = EasyAI_Server

}

export default EasyAI