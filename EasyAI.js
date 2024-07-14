import EasyAI_Server from "./core/EasyAI_Server.js";
import LlamaCPP from "./core/Llama/LlamaCPP.js"
import consumeGenerateRoute from "./core/useful/consumeGenerateRoute.js";
import ChatModule from "./core/ChatModule/ChatModule.js";
import isNonEmptyFunction from "./core/useful/isNonEmptyFunction.js";
import renameProperty from './core/useful/renameProperty.js'
import OpenAI from './core/OpenAI.js'
import EasyAI_WebGPT from "./core/EasyAI_WebGPT.js";
import ChatPrompt from "./core/MenuCLI/Sandbox/ChatPrompt.js";

class EasyAI {
    constructor(config = {openai_token : '',openai_model : undefined,server_url : '',server_port : 4000,server_token : '',llama : {vulkan : false,cmake : false,server_port : undefined,git_hash : undefined,llama_model : '',cuda : false,gpu_layers : undefined,threads : undefined,lora : undefined,lorabase : undefined,context : undefined,slots : undefined,mlock : undefined,mmap : undefined}}){

        this.ChatModule = new ChatModule()
        this.OpenAI = (config.openai_token) ? new OpenAI(config.openai_token,{model : config.openai_model}) : null

        this.ServerURL = config.server_url || null
        this.ServerPORT = config.server_port || 4000
        this.ServerTOKEN = config.server_token || null


        if(!this.ServerURL && !this.OpenAI){
            this.LlamaCPP = new LlamaCPP({
                server_port : (config.llama) ? config.llama.server_port : undefined,
                git_hash : (config.llama) ? config.llama.git_hash : undefined,
                modelpath : (config.llama) ? config.llama.llama_model : undefined,
                cuda : (config.llama) ? config.llama.cuda : undefined,
                gpu_layers : (config.llama) ? config.llama.gpu_layers : undefined,
                threads : (config.llama) ? config.llama.threads : undefined,
                lora : (config.llama) ? config.llama.lora : undefined,
                lorabase : (config.llama) ? config.llama.lorabase : undefined,
                context : (config.llama) ? config.llama.context : undefined,
                slots : (config.llama) ? config.llama.slots : undefined,
                mlock : (config.llama) ? config.llama.mlock : undefined,
                mmap : (config.llama) ? config.llama.mmap : undefined,
                cmake : (config.llama) ? config.llama.cmake : undefined,
                vulkan : (config.llama) ? config.llama.vulkan : undefined,
            })
        }
    }

async Generate(prompt = 'Once upon a time', config = {openai : false,logerror : false, stream: true, retryLimit: 420000,tokenCallback : () => {}}) {

    if (typeof config.tokenCallback === 'function' && isNonEmptyFunction(config.tokenCallback)) {
        config.stream = true;
    } else {
        config.stream = false;
    }

        if(this.ServerURL || this.OpenAI){

            if(this.ServerURL){
                if(config.openai && this.OpenAI){
                    delete config.openai
                    return await this.OpenAI.Generate(prompt,config)
                } else {
                    return await consumeGenerateRoute({serverUrl : this.ServerURL,port : this.ServerPORT,prompt : prompt,token : this.ServerTOKEN,config : config,onData : config.tokenCallback})
                }
                
            } else if(this.OpenAI){
                return await this.OpenAI.Generate(prompt,config)
            }

        } else {

            let attempts = 0;
            const startTime = Date.now();
            let lastLogTime = Date.now(); 
            const retryLimit = config.retryLimit !== undefined ? config.retryLimit : 420000;
    
            while ((Date.now() - startTime) < retryLimit) {
                let result = await this.LlamaCPP.Generate(prompt, config, config.tokenCallback);
                if (result !== false) {
                    result = renameProperty(result,'content','full_text')
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

async Chat(messages = [{role : 'user',content : 'Who won the world series in 2020?'}],config = {openai_avoidchat : false,openai : false,logerror : false, stream: true, retryLimit: 420000,tokenCallback : () => {}}){

  
        if((config.openai || this.OpenAI) && !config.openai_avoidchat){
            delete config.openai
            return await this.OpenAI.Chat(messages,config)
        } else {
            let final_prompt = ChatPrompt

            messages.forEach(e => {
                let ROLE
                if(e.role == 'user'){
                    ROLE = 'User: '
                } else if(e.role == 'assistant'){
                    ROLE = 'AI: '
                }
                final_prompt = `${final_prompt}${ROLE}${e.content} | `
               })
            
               config.stop = ['|']
            return await this.Generate(`${final_prompt}AI: `,config)
        }
        
    }

async PrintGenerate(prompt){
    console.log((await this.Generate(prompt)).full_text)
}    

static Sleep = async (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

static Server = EasyAI_Server

static WebGPT = EasyAI_WebGPT

}

export default EasyAI