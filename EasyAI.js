import EasyAI_Server from "./core/EasyAI_Server.js";
import LlamaCPP from "./core/Llama/LlamaCPP.js"
import consumeGenerateRoute from "./core/useful/consumeGenerateRoute.js";
import ChatModule from "./core/ChatModule/ChatModule.js";
import isNonEmptyFunction from "./core/useful/isNonEmptyFunction.js";
import renameProperty from './core/useful/renameProperty.js'
import OpenAI from './core/OpenAI.js'
import EasyAI_WebGPT from "./core/EasyAI_WebGPT.js";
import ChatPrompt from "./core/MenuCLI/Sandbox/ChatPrompt.js";
import LogMaster from './core/LogMaster.js'
import FileTool from "./core/useful/FileTool.js";

class EasyAI {
    constructor(config = {
        LlamaCPP_InstancesLimit : 100,
        ScaleMode : 'Process',
        SleepTolerance : 300000,
        openai_token : '',
        openai_model : undefined,
        server_url : '',
        server_port : 4000,
        server_token : '',
        llama : {jbuild : false,
            vulkan : false,
            cmake : false,
            server_port : undefined,
            git_hash : undefined,
            llama_model : '',
            cuda : false,
            gpu_layers : undefined,
            threads : undefined,
            lora : undefined,
            lorabase : undefined,
            context : undefined,
            slots : undefined,
            mlock : undefined,
            mmap : undefined}}){

        this.Config = config

        //this.Config.SleepTolerance = 30000

        this.ChatModule = new ChatModule()
        this.OpenAI = (config.openai_token) ? new OpenAI(config.openai_token,{model : config.openai_model}) : null

        this.ServerURL = config.server_url || null
        this.ServerPORT = config.server_port || 4000
        this.ServerTOKEN = config.server_token || null

        this.LlamaCPP = {
            Instances : [],
            NewInstance : () => {
                this.LlamaCPP.Instances.push(new LlamaCPP({
                    server_port : (this.Config.llama) ? this.Config.llama.server_port : undefined,
                    git_hash : (this.Config.llama) ? this.Config.llama.git_hash : undefined,
                    modelpath : (this.Config.llama) ? this.Config.llama.llama_model : undefined,
                    cuda : (this.Config.llama) ? this.Config.llama.cuda : undefined,
                    gpu_layers : (this.Config.llama) ? this.Config.llama.gpu_layers : undefined,
                    threads : (this.Config.llama) ? this.Config.llama.threads : undefined,
                    lora : (this.Config.llama) ? this.Config.llama.lora : undefined,
                    lorabase : (this.Config.llama) ? this.Config.llama.lorabase : undefined,
                    context : (this.Config.llama) ? this.Config.llama.context : undefined,
                    slots : (this.Config.llama) ? this.Config.llama.slots : undefined,
                    mlock : (this.Config.llama) ? this.Config.llama.mlock : undefined,
                    mmap : (this.Config.llama) ? this.Config.llama.mmap : undefined,
                    cmake : (this.Config.llama) ? this.Config.llama.cmake : undefined,
                    vulkan : (this.Config.llama) ? this.Config.llama.vulkan : undefined,
                    jbuild : (this.Config.llama) ? this.Config.llama.jbuild : undefined
                }))
            },
            RestartAll : () => {

            },
            Cleaner : setInterval(() => {
                this.LlamaCPP_Instances.forEach((e,i) => {
                    if(((Date.now()-e.LastAction) > this.Config.SleepTolerance) && i != 0){
                        this.LlamaCPP_Instances.splice(i,1)
                    }
                })
            },10000),

            Log : setInterval(() => {
                LogMaster.Log('LlamaCPP_Instances',this.LlamaCPP_Instances)
            },1000)
        }


        if(!this.ServerURL && !this.OpenAI){
            this.LlamaCPP.NewInstance()
            
        }

        
        this.Executions = []
        
        // de forma geral criar id unico e ID UNICO em escala plugavel


        //utilziar isso abaixo e criar na mesma levada do LogMaster, quem sabe dentro, uma para visualizar em escala varias instancias, HUD onde seja possivel visualizar grupos de 10mi-20mi instancias com facilidade (simulador para testar o hud antes de produçãi )
        /*
        this.Info = {
            Type :  'Native',
            Status : 'Starting',
            Engine : ''
        }
        */

/*
        LogMaster.Log('EasyAI Instance',{
            ...(this.LlamaCPP && {
                Event : 'Start',
                Engine : 'LlamaCPP',
                Threads : this.LlamaCPP.Threads,
                Model : `${FileTool.fileName(this.LlamaCPP.ModelPath)} | ${FileTool.fileSize(this.LlamaCPP.ModelPath,{includeUnit : true})}`
            }),
            ...(this.ServerURL && {
                ServerConnection : `${this.ServerURL}:${this.ServerPORT}`
            }),
            ...(this.OpenAI && {
                OpenAI_Connection : true
            }),
            
        })
*/        

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