import EasyAI_Server from "./core/EasyAI_Server.js";
import LlamaCPP from "./core/Llama/LlamaCPP.js"
import consumeGenerateRoute from "./useful/consumeGenerateRoute.js";
import ChatModule from "./core/ChatModule/ChatModule.js";

class EasyAI {
    constructor(config = {server_url : '',server_port : 4000,server_token : '',llama : {llama_model : '',gpu_layers : undefined,threads : undefined,lora : undefined,lorabase : undefined,context : undefined}}){

        this.ChatModule = new ChatModule()

        this.ServerURL = config.server_url || null
        this.ServerPORT = config.server_port || 4000
        this.ServerTOKEN = config.server_token || null


        if(!this.ServerURL){
            this.LlamaCPP = new LlamaCPP({modelpath : (config.llama) ? config.llama.llama_model : undefined,gpu_layers : (config.llama) ? config.llama.gpu_layers : undefined,threads : (config.llama) ? config.llama.threads : undefined,lora : (config.llama) ? config.llama.lora : undefined,lorabase : (config.llama) ? config.llama.lorabase : undefined,context : (config.llama) ? config.llama.context : undefined})
        }
    }

async Generate(prompt = 'Once upon a time', config = {logerror : false, stream: false, retryLimit: 420000,tokenCallback : () => {}}) {

        if(!config.tokenCallback){
            config.tokenCallback = () => {}
            config.stream = false
        } else {
            config.stream = true
        }

        if(this.ServerURL){

            return await consumeGenerateRoute({serverUrl : this.ServerURL,port : this.ServerPORT,prompt : prompt,token : this.ServerTOKEN,config : config,onData : config.tokenCallback})

        } else {

            let attempts = 0;
            const startTime = Date.now();
            let lastLogTime = Date.now(); 
            const retryLimit = config.retryLimit !== undefined ? config.retryLimit : 420000;
    
            while ((Date.now() - startTime) < retryLimit) {
                const result = await this.LlamaCPP.Generate(prompt, config, config.tokenCallback);
                if (result !== false) {
                    return result;
                }
                
                await EasyAI.Sleep(3000);
                
                attempts++;
    
                if ((Date.now() - lastLogTime) >= 40000 || attempts == 1) {
                    if(config.logerror){
                        console.log("Não foi possível executar o método Generate() | Tentando novamente...");
                    }
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