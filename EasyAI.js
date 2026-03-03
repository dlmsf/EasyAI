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
import generateUniqueCode from "./core/util/generateUniqueCode.js";
import ConfigManager from "./core/ConfigManager.js";
import {exec} from 'child_process'
import DeepInfra from './core/DeepInfra.js'
import NewChatPrompt from "./core/util/NewChatPrompt.js";
import consumeChatRoute from "./core/useful/consumeChatRoute.js";
import FlowChatManager from "./core/FlowChat/FlowChatManager.js";
import { FlowChatPrompts } from "./core/FlowChat/prompts.js";



class EasyAI {
    /**
 * @param {Object} config
 * @param {boolean} [config.Llamacpp_InstancesRawLog=false]
 * @param {number} [config.GenerateTimeout=60000]
 * @param {number} [config.LlamaCPP_InstancesLimit=100]
 * @param {string} [config.ScaleMode='Process']
 * @param {number} [config.SleepTolerance=300000]
 * @param {string} [config.openai_token='']
 * @param {string} [config.openai_model]
 * @param {string} [config.deepinfra_token='']
 * @param {string} [config.deepinfra_model]
 * @param {string} [config.server_url='']
 * @param {number} [config.server_port=4000]
 * @param {string} [config.server_token='']
 * @param {Object} [config.llama]
 * @param {boolean} [config.llama.jbuild=false]
 * @param {boolean} [config.llama.vulkan=false]
 * @param {boolean} [config.llama.cmake=false]
 * @param {number} [config.llama.server_port]
 * @param {string} [config.llama.git_hash]
 * @param {string} [config.llama.llama_model='']
 * @param {boolean} [config.llama.cuda=false]
 * @param {number} [config.llama.gpu_layers]
 * @param {number} [config.llama.threads]
 * @param {string} [config.llama.lora]
 * @param {string} [config.llama.lorabase]
 * @param {number} [config.llama.context]
 * @param {number} [config.llama.slots]
 * @param {boolean} [config.llama.mlock]
 * @param {boolean} [config.llama.mmap]
 */
constructor(config = {}) {
    const defaults = {
        Llamacpp_InstancesRawLog: false,
        GenerateTimeout: 60000,
        LlamaCPP_InstancesLimit: 100,
        ScaleMode: 'Process',
        SleepTolerance: 200000,
        openai_token: '',
        openai_model: undefined,
        deepinfra_token : '',
        deepinfra_model : undefined,
        server_url: '',
        server_port: 4000,
        server_token: '',
        llama: {
            jbuild: false,
            vulkan: false,
            cmake: false,
            server_port: undefined,
            git_hash: undefined,
            llama_model: '',
            cuda: false,
            gpu_layers: undefined,
            threads: undefined,
            lora: undefined,
            lorabase: undefined,
            context: undefined,
            slots: undefined,
            mlock: undefined,
            mmap: undefined
        }
    };

    this.Made = false
    this.Checker = {
        Runnage : setInterval(() => {
            if(!this.Made){
                let quant = 0
                this.LlamaCPP.Instances.forEach(e => {
                    if(e.ServerOn && quant < 1){
                        quant++
                        console.log('reiniciando')
                        this.Made = true
                        this.Checker.Runnage = null
                        this.LlamaCPP.Instances = []
                        this.LlamaCPP.NewInstance()
                    }
                })
                
            }
        },500)
    }
    
    this.Config = {
        ...defaults,
        ...config,
        llama: {
            ...defaults.llama,
            ...(config.llama || {})
        }
    };
        //this.Config.SleepTolerance = 20000
        if(ConfigManager.getKey('start-llamacpp-instanceslog')){this.Config.Llamacpp_InstancesRawLog = true}

        this.ChatModule = new ChatModule()
        this.OpenAI = (config.openai_token) ? new OpenAI(config.openai_token,{model : config.openai_model}) : null
        this.DeepInfra = (config.deepinfra_token) ? new DeepInfra(config.deepinfra_token,{model : config.deepinfra_model,log : config.deepinfra_log}) : null

        this.ServerURL = config.server_url || null
        this.ServerPORT = config.server_port || 4000
        this.ServerTOKEN = config.server_token || null

        this.LlamaCPP = {
            Instances: [],
            NewInstance: () => {
                let uniqueid = generateUniqueCode({length : 6,existingObjects : this.LlamaCPP.Instances,codeProperty : 'UniqueID'})

                this.LlamaCPP.Instances.push(new LlamaCPP({
                    uniqueid : uniqueid,
                    server_port: (this.Config.llama) ? this.Config.llama.server_port : undefined,
                    git_hash: (this.Config.llama) ? this.Config.llama.git_hash : undefined,
                    modelpath: (this.Config.llama) ? this.Config.llama.llama_model : undefined,
                    cuda: (this.Config.llama) ? this.Config.llama.cuda : undefined,
                    gpu_layers: (this.Config.llama) ? this.Config.llama.gpu_layers : undefined,
                    threads: (this.Config.llama) ? this.Config.llama.threads : undefined,
                    lora: (this.Config.llama) ? this.Config.llama.lora : undefined,
                    lorabase: (this.Config.llama) ? this.Config.llama.lorabase : undefined,
                    context: (this.Config.llama) ? this.Config.llama.context : undefined,
                    slots: (this.Config.llama) ? this.Config.llama.slots : undefined,
                    mlock: (this.Config.llama) ? this.Config.llama.mlock : undefined,
                    mmap: (this.Config.llama) ? this.Config.llama.mmap : undefined,
                    cmake: (this.Config.llama) ? this.Config.llama.cmake : undefined,
                    vulkan: (this.Config.llama) ? this.Config.llama.vulkan : undefined,
                    jbuild: (this.Config.llama) ? this.Config.llama.jbuild : undefined
                }))
        
                if (this.LlamaCPP.Instances.length === 1) {
                    this.LlamaCPP.startIntervals();
                    this.LlamaCPP.startQueueProcessor();
                }
            return uniqueid
            },
            RestartAll: () => {
                
            },
            Cleaner: null,
            Log: null,
            QueueProcessor: null,
            startIntervals: () => {
                if (!this.LlamaCPP.Cleaner && this.LlamaCPP.Instances.length > 0) {
                    this.LlamaCPP.Cleaner = setInterval(() => {
                        this.LlamaCPP.Instances.forEach((instance, index) => {
                            if (((Date.now() - instance.LastAction) > this.Config.SleepTolerance) && index != 0 && !this.LlamaCPP.Instances[index].InUse) {
                                exec(`kill -9 ${this.LlamaCPP.Instances[index].ProcessPID}`, (error) => {
                                    if (error) console.error(`Error killing process: ${error}`);
                                  })
                                this.LlamaCPP.Instances.splice(index, 1)
                                if (this.LlamaCPP.Instances.length === 0) {
                                    this.LlamaCPP.stopAll();
                                }
                            }
                        })
                    }, 10000)
                    
                    if(this.Config.Llamacpp_InstancesRawLog){
                        this.LlamaCPP.Log = setInterval(() => {
                            LogMaster.Log('LlamaCPP Instances', this.LlamaCPP.Instances,{statusMode : true})
                        }, 100)
                    }
                }
            },
            startQueueProcessor: () => {
                if (!this.LlamaCPP.QueueProcessor) {
                    const processQueue = () => {
                        if (!this.LlamaCPP || !this.LlamaCPP.GetInstance_Queue) {
                            this.LlamaCPP.QueueProcessor = setTimeout(processQueue, 100);
                            return;
                        }
        
                        this.LlamaCPP.GetInstance_Queue.forEach((request, index) => {
                            if (request.index === -1) {
                                let instanceIndex = this.LlamaCPP.Instances.findIndex(instance => instance.InUse == false);
                                let created_uniqueid
                                if(!request.noCreation && instanceIndex == -1){
                                    created_uniqueid = this.LlamaCPP.NewInstance();
                                    instanceIndex = this.LlamaCPP.Instances.findIndex(instance => instance.UniqueID == created_uniqueid);
                                    this.LlamaCPP.GetInstance_Queue[index].index = instanceIndex
                                    this.LlamaCPP.Instances[instanceIndex].InUse = true;
                                } else {
                                    this.LlamaCPP.GetInstance_Queue[index].index = instanceIndex
                                }

                                this.LlamaCPP.GetInstance_Queue[index].ready = true
                            }
                        });
        
                        this.LlamaCPP.QueueProcessor = setTimeout(processQueue, 10);
                    };
                    this.LlamaCPP.QueueProcessor = setTimeout(processQueue, 10);
                }
            },
            stopAll: () => {
                if (this.LlamaCPP.Cleaner) {
                    clearInterval(this.LlamaCPP.Cleaner)
                    this.LlamaCPP.Cleaner = null
                }
                if (this.LlamaCPP.Log) {
                    clearInterval(this.LlamaCPP.Log)
                    this.LlamaCPP.Log = null
                }
                if (this.LlamaCPP.QueueProcessor) {
                    clearTimeout(this.LlamaCPP.QueueProcessor)
                    this.LlamaCPP.QueueProcessor = null
                }
            },
            GetInstance_Queue: [],
            GetInstance: async (config = {noCreation : false}) => {
                let code = generateUniqueCode({ 
                    length: 10, 
                    existingObjects: this.LlamaCPP.GetInstance_Queue, 
                    codeProperty: 'id' 
                })
                this.LlamaCPP.GetInstance_Queue.push({
                    ready : false,
                    id: code,
                    noCreation : config.noCreation || false,
                    index: -1
                })
        
                const waitUntilReady = (code) => {
                    return new Promise((resolve) => {
                        const check = () => {
                            const instance = this.LlamaCPP.GetInstance_Queue.find(queueItem => queueItem.id == code);
                            if (instance && instance.ready == true) {
                                resolve(instance);
                            } else {
                                setTimeout(check, 10);
                            }
                        }
                        check();
                    });
                }
        
                await waitUntilReady(code)
                
                let queueIndex = this.LlamaCPP.GetInstance_Queue.findIndex(queueItem => queueItem.id == code)
                let instanceIndex = this.LlamaCPP.GetInstance_Queue[queueIndex].index
                this.LlamaCPP.GetInstance_Queue.splice(queueIndex, 1)
                return instanceIndex
            }
        }
        
        this.WaitServerOn = async (instanceIndex) => {
            if (!this.LlamaCPP.Instances[instanceIndex]) {
                return -1;
            }
            
            const timeout = this.Config.GenerateTimeout;
            const startTime = Date.now();
            
            while (!this.LlamaCPP.Instances[instanceIndex].ServerOn) {
            
                if (Date.now() - startTime > timeout) {
                    return -1;
                }
                
            
                const newInstanceIndex = await this.LlamaCPP.GetInstance({ noCreation: true });
                
                if (newInstanceIndex !== -1 && newInstanceIndex !== instanceIndex) {
               
                    this.LlamaCPP.Instances[newInstanceIndex].InUse = true;
                    this.LlamaCPP.Instances[instanceIndex].InUse = false;
                    return newInstanceIndex;
                }
                
              
                await new Promise(resolve => setTimeout(resolve, 30));
            }
            
           
            return instanceIndex;
        }

        if(!this.ServerURL && !this.OpenAI && !this.DeepInfra){
            this.LlamaCPP.NewInstance()
            
        }

       
        
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

async Generate(prompt = 'Once upon a time', config = {openai : false,deepinfra : false,logerror : false, stream: true, retryLimit: 420000,tokenCallback : () => {}}) {

    if (typeof config.tokenCallback === 'function' && isNonEmptyFunction(config.tokenCallback)) {
        config.stream = true;
    } else {
        config.stream = false;
    }

        if(this.ServerURL || this.OpenAI || this.DeepInfra){

            if(this.ServerURL){
                if((config.openai && this.OpenAI) || (config.deepinfra && this.DeepInfra)){
                    if(config.openai && this.OpenAI){
                        delete config.openai
                        return await this.OpenAI.Generate(prompt,config)
                        .catch(e =>{
                            const tokens = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
                        consume_result.full_text = "Sorry, I'm unable to respond at the moment.";
                    
                        if(config.stream == true){ 
                            return new Promise((resolve) => {
                                let i = 0;
                                (function next() {
                                    if (i < tokens.length) {
                                        config.tokenCallback({stream: {content: tokens[i]}});
                                        i++;
                                        setTimeout(next, 45);
                                    } else {
                                        resolve(consume_result); // testar trocando por '' dps
                                    }
                                })();
                            });
                        }

                        })
                    } else if(config.deepinfra && this.DeepInfra) {
                        return await this.DeepInfra.Generate(prompt,config)
                        .catch(e =>{
                            const tokens = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
                        consume_result.full_text = "Sorry, I'm unable to respond at the moment.";
                    
                        if(config.stream == true){ 
                            return new Promise((resolve) => {
                                let i = 0;
                                (function next() {
                                    if (i < tokens.length) {
                                        config.tokenCallback({stream: {content: tokens[i]}});
                                        i++;
                                        setTimeout(next, 45);
                                    } else {
                                        resolve(consume_result); // testar trocando por '' dps
                                    }
                                })();
                            });
                        }

                        })
                    }
                    
                } else {
                    let consume_result = await consumeGenerateRoute({serverUrl : this.ServerURL,port : this.ServerPORT,prompt : prompt,token : this.ServerTOKEN,config : config,onData : config.tokenCallback})
                    if(consume_result.error && (consume_result.error == 'server offline' || consume_result.error == 'Invalid token.')){
                        const tokens = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
                        consume_result.full_text = "Sorry, I'm unable to respond at the moment.";
                    
                        if(config.stream == true){ 
                            return new Promise((resolve) => {
                                let i = 0;
                                (function next() {
                                    if (i < tokens.length) {
                                        config.tokenCallback({stream: {content: tokens[i]}});
                                        i++;
                                        setTimeout(next, 45);
                                    } else {
                                        resolve(consume_result); // testar trocando por '' dps
                                    }
                                })();
                            });
                        }
                    }

                    return consume_result
                }
                
            } else if(this.OpenAI || this.DeepInfra){
                    if(this.OpenAI){
                        return await this.OpenAI.Generate(prompt,config)
                        .catch(e =>{
                            const tokens = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
                        consume_result.full_text = "Sorry, I'm unable to respond at the moment.";
                    
                        if(config.stream == true){ 
                            return new Promise((resolve) => {
                                let i = 0;
                                (function next() {
                                    if (i < tokens.length) {
                                        config.tokenCallback({stream: {content: tokens[i]}});
                                        i++;
                                        setTimeout(next, 45);
                                    } else {
                                        resolve(consume_result); // testar trocando por '' dps
                                    }
                                })();
                            });
                        }

                        })
                    } else if(this.DeepInfra){
                        return await this.DeepInfra.Generate(prompt,config)
                        .catch(e =>{
                            const tokens = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
                        consume_result.full_text = "Sorry, I'm unable to respond at the moment.";
                    
                        if(config.stream == true){ 
                            return new Promise((resolve) => {
                                let i = 0;
                                (function next() {
                                    if (i < tokens.length) {
                                        config.tokenCallback({stream: {content: tokens[i]}});
                                        i++;
                                        setTimeout(next, 45);
                                    } else {
                                        resolve(consume_result); // testar trocando por '' dps
                                    }
                                })();
                            });
                        }

                        })
                    }
               
            }

        } else {
            let result = {}

            let index = await this.LlamaCPP.GetInstance()
            if(this.LlamaCPP.Instances[index].ServerOn){
                result = await this.LlamaCPP.Instances[index].Generate(prompt, config, config.tokenCallback);
                if (result !== false) {
                    result = renameProperty(result,'content','full_text')
                    
                }
            } else {
                let serveron_index = await this.WaitServerOn(index)
                if(serveron_index != -1){
                        result = await this.LlamaCPP.Instances[serveron_index].Generate(prompt, config, config.tokenCallback);
                        if (result !== false) {
                            result = renameProperty(result,'content','full_text')
                         }
                   
                    } else {
                       
                        const tokens = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
                        result.full_text = "Sorry, I'm unable to respond at the moment.";
                    
                        if(config.stream == true){ 
                            return new Promise((resolve) => {
                                let i = 0;
                                (function next() {
                                    if (i < tokens.length) {
                                        config.tokenCallback({stream: {content: tokens[i]}});
                                        i++;
                                        setTimeout(next, 45);
                                    } else {
                                        resolve('');
                                    }
                                })();
                            });
                        }

                    }
                     
                    }
            
            return result

         

        }

    }

    // In EasyAI.js - Chat method, add validation
async Chat(messages = [], config = {}) {
    // Clean and validate messages before sending
    const cleanMessages = messages
        .filter(msg => msg && msg.role && msg.content)
        .map(msg => ({
            role: msg.role,
            content: typeof msg.content === 'string' 
                ? msg.content 
                : String(msg.content)  // Convert to string if it's not
        }))
        .filter(msg => {
            // Filter out messages that look like JSON streaming data
            const isJsonStream = msg.content.includes('"full_text"') || 
                                msg.content.includes('"stream"') ||
                                msg.content.includes('"token"')
            if (isJsonStream) {
                console.warn('Filtered out JSON stream data from message')
                return false
            }
            return true
        })
    
    // Limit to last 20 messages to prevent explosion
    const limitedMessages = cleanMessages.slice(-20)
    
    if(this.ServerURL){
    let consume_result = await consumeChatRoute({serverUrl : this.ServerURL,port : this.ServerPORT,messages : limitedMessages,token : this.ServerTOKEN,config : config,onData : config.tokenCallback})
                    if(consume_result.error && (consume_result.error == 'server offline' || consume_result.error == 'Invalid token.')){
                        const tokens = ["Sorry", ", ", "I'm ", "unable ", "to ", "respond ", "at ", "the ", "moment."];
                        consume_result.full_text = "Sorry, I'm unable to respond at the moment.";
                    
                        if(config.stream == true){ 
                            return new Promise((resolve) => {
                                let i = 0;
                                (function next() {
                                    if (i < tokens.length) {
                                        config.tokenCallback({stream: {content: tokens[i]}});
                                        i++;
                                        setTimeout(next, 45);
                                    } else {
                                        resolve(consume_result); // testar trocando por '' dps
                                    }
                                })();
                            });
                        }
                    }

                    return consume_result
                }

    // Handle OpenAI
    if ((config.openai || this.OpenAI) && !config.openai_avoidchat) {
        delete config.openai;
        return await this.OpenAI.Chat(limitedMessages, config);
    }

    if ((config.deepinfra || this.DeepInfra) && !config.deepinfra_avoidchat) {
        delete config.deepinfra;
        return await this.DeepInfra.Chat(limitedMessages, config);
    }
    
    // Handle DeepInfra
    if (this.DeepInfra) {
        let systemMessage = config.systemMessage;
        if (!systemMessage && config.systemType) {
            systemMessage = NewChatPrompt.SYSTEM_TYPES[config.systemType];
        }
        
        const final_prompt = NewChatPrompt.build(limitedMessages, systemMessage);
        
        return await this.Generate(final_prompt, {
            ...config,
            stop: ['<|im_end|>']
        });
    }
    
    // For local LlamaCPP
    let systemMessage = config.systemMessage;
    if (!systemMessage && config.systemType) {
        systemMessage = NewChatPrompt.SYSTEM_TYPES[config.systemType];
    }
    
    const final_prompt = NewChatPrompt.build(limitedMessages, systemMessage);
    
    return await this.Generate(final_prompt, {
        ...config,
        stop: ['<|im_end|>']
    });
}



// Complete rewritten FlowChat method for EasyAI.js with multi-objective support

// Complete rewritten FlowChat method for EasyAI.js with multi-objective support and proper completion detection

async FlowChat({ message, chatid, id, tokenCallback = () => {} }) {
    // Initialize FlowChat manager if not exists
    if (!this.FlowChatManager) {
        this.FlowChatManager = new FlowChatManager();
    }

    // Get or create chat
    let chat = await this.FlowChatManager.getOrLoadChat(chatid);
    
    if (!chat) {
        // First message creates the chat with this user as admin
        chat = await this.FlowChatManager.createChat(chatid, id, message);
        
        // Initial response - guide admin to create objectives
        //const initialResponse = "Welcome! I'm your objective-driven assistant. Since you're the admin, let's set up your first objective. What would you like to achieve in this chat? I'll help you create clear, actionable objectives.\n\nYou can specify:\n- Simple objective (just tracking completion)\n- Form objective (collect specific data)\n- Registration type: single (one per user) or multiple (unlimited entries)\n- Max registrations (optional)";
        const initialResponse = "Bem-vindo! Sou seu assistente orientado a objetivos. Como você é o administrador, vamos configurar seu primeiro objetivo. O que você gostaria de alcançar neste chat? Vou ajudá-lo a criar objetivos claros e acionáveis.\n\nVocê pode especificar:\n- Objetivo simples (apenas acompanhamento de conclusão)\n- Objetivo com formulário (coletar dados específicos)\n- Tipo de registro: único (um por usuário) ou múltiplo (entradas ilimitadas)\n- Máximo de registros (opcional)";
        if (tokenCallback) {
            for (const word of initialResponse.split(' ')) {
                tokenCallback(word + ' ');
                await EasyAI.Sleep(30);
            }
        }
        
        await this.FlowChatManager.addMessage(chatid, 'system', initialResponse);
        
        return {
            full_text: initialResponse,
            chatid,
            isAdmin: true,
            status: 'setup'
        };
    }

    // Add user message to history
    await this.FlowChatManager.addMessage(chatid, id, message);
    
    const isAdmin = this.FlowChatManager.isAdmin(chatid, id);
    
    // Analyze the message to determine action
    const analysis = await this.FlowChatManager.analyzeUserMessage(chatid, message, isAdmin);
    
    // Handle blocked users (non-admins when no objectives)
    if (analysis.action === 'blocked') {
        const blockedResponse = "This chat is currently being set up by an admin. Please wait for objectives to be created before participating.";
        
        if (tokenCallback) {
            for (const word of blockedResponse.split(' ')) {
                tokenCallback(word + ' ');
                await EasyAI.Sleep(30);
            }
        }
        
        return {
            full_text: blockedResponse,
            chatid,
            isAdmin: false,
            status: 'blocked'
        };
    }
    
    // Handle completed chat
    if (analysis.action === 'completed') {
        const completedResponse = "All objectives have been completed. This chat session is finished. Thank you for your participation!";
        
        if (tokenCallback) {
            for (const word of completedResponse.split(' ')) {
                tokenCallback(word + ' ');
                await EasyAI.Sleep(30);
            }
        }
        
        return {
            full_text: completedResponse,
            chatid,
            isAdmin,
            status: 'completed'
        };
    }
    
    // ========== MULTI-OBJECTIVE INTELLIGENT DETECTION ==========
    // First, get all active objectives
    const allObjectives = chat.objectives.filter(obj => obj.status === 'active');
    const objectivesSummary = this.FlowChatManager.formatObjectivesForPrompt(chatid, true, id);
    
    // For users (non-admins) with multiple objectives, we need intelligent routing
    if (!isAdmin && allObjectives.length > 0) {
        
        // Step 1: Detect which objective the user is referring to
        const objectiveDetectionPrompt = [
            { 
                role: 'system', 
                content: `You are an objective detector. Analyze the user message and determine which objective they want to work on.

Available objectives:
${allObjectives.map((obj, idx) => `${idx + 1}. "${obj.description}" (ID: ${obj.id})`).join('\n')}

Rules:
1. If the user explicitly mentions an objective by name/number, select that one
2. If the user provides data that matches a specific objective's fields, select that one
3. If the user is continuing a conversation, check their recent registrations
4. If ambiguous, select the most relevant based on context
5. If truly ambiguous, set selectedObjectiveId to null for clarification

Respond with JSON only: {
    "selectedObjectiveId": string or null,
    "confidence": number 0-1,
    "reasoning": string,
    "needsClarification": boolean,
    "clarificationQuestion": string (if needsClarification)
}` 
            },
            { role: 'user', content: message }
        ];
        
        try {
            const detection = await this.Chat(objectiveDetectionPrompt, { 
                temperature: 0.1, 
                response_format: { type: "json_object" } 
            });
            
            const detectionResult = JSON.parse(detection.full_text);
            
            // If clarification needed, ask the user
            if (detectionResult.needsClarification && detectionResult.clarificationQuestion) {
                if (tokenCallback) {
                    for (const word of detectionResult.clarificationQuestion.split(' ')) {
                        tokenCallback(word + ' ');
                        await EasyAI.Sleep(30);
                    }
                }
                
                await this.FlowChatManager.addMessage(chatid, 'system', detectionResult.clarificationQuestion);
                
                return {
                    full_text: detectionResult.clarificationQuestion,
                    chatid,
                    isAdmin: false,
                    status: chat.status,
                    objectives: this.FlowChatManager.getObjectivesSummary(chatid)
                };
            }
            
            // Get the selected objective
            let targetObjective = null;
            if (detectionResult.selectedObjectiveId) {
                targetObjective = chat.objectives.find(obj => obj.id === detectionResult.selectedObjectiveId);
            }
            
            // If no clear objective detected, show all available objectives
            if (!targetObjective) {
                const availableObjectivesResponse = `I can help you with multiple objectives. Which one would you like to work on?\n\n${allObjectives.map((obj, idx) => {
                    const userRegs = obj.registrations?.filter(r => r.userId === id) || [];
                    const inProgress = userRegs.find(r => r.status === 'in-progress');
                    const completed = userRegs.filter(r => r.status === 'completed').length;
                    
                    let status = `📝 ${obj.description}`;
                    if (inProgress) status += ` (in progress)`;
                    else if (completed > 0) status += ` (${completed} completed)`;
                    
                    return `${idx + 1}. ${status}`;
                }).join('\n')}\n\nPlease tell me which objective number or name you want to work on.`;
                
                if (tokenCallback) {
                    for (const word of availableObjectivesResponse.split(' ')) {
                        tokenCallback(word + ' ');
                        await EasyAI.Sleep(30);
                    }
                }
                
                await this.FlowChatManager.addMessage(chatid, 'system', availableObjectivesResponse);
                
                return {
                    full_text: availableObjectivesResponse,
                    chatid,
                    isAdmin: false,
                    status: chat.status,
                    objectives: this.FlowChatManager.getObjectivesSummary(chatid)
                };
            }
            
            // ========== PROCESS DATA FOR THE SELECTED OBJECTIVE ==========
            // Now we know exactly which objective to work on
            if (targetObjective.type === 'form') {
                
                // Check if user can submit more data to this objective
                const userRegistrations = targetObjective.registrations?.filter(r => r.userId === id) || [];
                const inProgressReg = userRegistrations.find(r => r.status === 'in-progress');
                
                // Check registration limits
                if (targetObjective.registrationType === 'single' && 
                    userRegistrations.some(r => r.status === 'completed')) {
                    
                    const blockedResponse = `You have already completed the objective "${targetObjective.description}". Multiple registrations are not allowed for this objective.`;
                    
                    if (tokenCallback) {
                        for (const word of blockedResponse.split(' ')) {
                            tokenCallback(word + ' ');
                            await EasyAI.Sleep(30);
                        }
                    }
                    
                    return {
                        full_text: blockedResponse,
                        chatid,
                        isAdmin: false,
                        status: 'active'
                    };
                }
                
                if (targetObjective.maxRegistrations && 
                    userRegistrations.length >= targetObjective.maxRegistrations) {
                    
                    const blockedResponse = `You have reached the maximum number of registrations (${targetObjective.maxRegistrations}) for objective "${targetObjective.description}".`;
                    
                    if (tokenCallback) {
                        for (const word of blockedResponse.split(' ')) {
                            tokenCallback(word + ' ');
                            await EasyAI.Sleep(30);
                        }
                    }
                    
                    return {
                        full_text: blockedResponse,
                        chatid,
                        isAdmin: false,
                        status: 'active'
                    };
                }
                
                // Find missing fields for this objective
                let missingFields = [];
                if (inProgressReg) {
                    missingFields = targetObjective.requiredData?.filter(
                        f => f.required && !inProgressReg.collectedData[f.name]
                    ) || [];
                } else {
                    missingFields = targetObjective.requiredData?.filter(f => f.required) || [];
                }
                
                // Check if there are fields to collect
                if (missingFields.length > 0) {
                    // Extract field values for THIS objective only
                    const fieldExtractionPrompt = [
                        { 
                            role: 'system', 
                            content: `You are a data extractor. Extract values for these fields from the user message for objective "${targetObjective.description}": ${JSON.stringify(missingFields)}.
                            
Rules:
1. Only extract values that match the field names and types
2. If multiple fields mentioned, extract all
3. Validate data types (text, number, date, choice)
4. Respond with JSON only: {"extracted": [{"name": "fieldName", "value": "extractedValue"}]}
5. If no values can be extracted, return {"extracted": []}` 
                        },
                        { role: 'user', content: message }
                    ];
                    
                    try {
                        const extraction = await this.Chat(fieldExtractionPrompt, { 
                            temperature: 0.1, 
                            response_format: { type: "json_object" } 
                        });
                        
                        const extracted = JSON.parse(extraction.full_text);
                        
                        if (extracted.extracted && extracted.extracted.length > 0) {
                            // Store each extracted field value in the CORRECT objective
                            let anyFieldStored = false;
                            for (const field of extracted.extracted) {
                                if (field.name && field.value) {
                                    const result = await this.FlowChatManager.collectObjectiveData(
                                        chatid, 
                                        targetObjective.id,
                                        field.name, 
                                        field.value,
                                        id
                                    );
                                    
                                    anyFieldStored = true;
                                    
                                    if (result && !result.success) {
                                        const errorResponse = result.message;
                                        if (tokenCallback) {
                                            for (const word of errorResponse.split(' ')) {
                                                tokenCallback(word + ' ');
                                                await EasyAI.Sleep(30);
                                            }
                                        }
                                        
                                        return {
                                            full_text: errorResponse,
                                            chatid,
                                            isAdmin: false,
                                            status: 'active'
                                        };
                                    }
                                }
                            }
                            
                            // If we stored at least one field, check completion status
                            if (anyFieldStored) {
                                // IMPORTANT: Reload the chat to get fresh data after saving
                                const updatedChat = await this.FlowChatManager.getOrLoadChat(chatid);
                                const updatedObjective = updatedChat.objectives.find(obj => obj.id === targetObjective.id);
                                
                                // Check for completed registrations for this user
                                const completedRegs = updatedObjective?.registrations?.filter(
                                    r => r.userId === id && r.status === 'completed'
                                ) || [];
                                
                                // Check for in-progress registration
                                const updatedInProgress = updatedObjective?.registrations?.find(
                                    r => r.userId === id && r.status === 'in-progress'
                                );
                                
                                // CASE 1: Registration was JUST completed (we have completed registrations and no in-progress)
                                if (completedRegs.length > 0 && !updatedInProgress) {
                                    // Get the most recent completed registration
                                    const latestCompleted = completedRegs.sort((a, b) => b.completedAt - a.completedAt)[0];
                                    
                                    // Build success message with registered data
                                    let completionMessage = `✅ **Registration completed successfully for "${updatedObjective.description}"!**\n\n`;
                                    completionMessage += "**Registered information:**\n";
                                    
                                    Object.entries(latestCompleted.collectedData).forEach(([key, data]) => {
                                        completionMessage += `• ${key}: ${data.value}\n`;
                                    });
                                    
                                    // Check if objective itself is now complete (max registrations reached)
                                    if (updatedObjective.status === 'completed') {
                                        completionMessage += `\n✨ **Objective fully completed!** ✨\n`;
                                    }
                                    
                                    // Check for other active objectives
                                    const otherActive = allObjectives.filter(obj => 
                                        obj.id !== targetObjective.id && obj.status === 'active'
                                    );
                                    
                                    if (otherActive.length > 0) {
                                        completionMessage += `\nYou can also work on:\n`;
                                        otherActive.forEach(obj => {
                                            const userRegs = obj.registrations?.filter(r => r.userId === id) || [];
                                            const hasInProgress = userRegs.some(r => r.status === 'in-progress');
                                            const hasCompleted = userRegs.some(r => r.status === 'completed');
                                            
                                            if (hasInProgress) {
                                                completionMessage += `• ${obj.description} (in progress)\n`;
                                            } else if (hasCompleted) {
                                                completionMessage += `• ${obj.description} (completed)\n`;
                                            } else {
                                                completionMessage += `• ${obj.description}\n`;
                                            }
                                        });
                                    }
                                    
                                    if (tokenCallback) {
                                        for (const word of completionMessage.split(' ')) {
                                            tokenCallback(word + ' ');
                                            await EasyAI.Sleep(30);
                                        }
                                    }
                                    
                                    await this.FlowChatManager.addMessage(chatid, 'system', completionMessage);
                                    
                                    return {
                                        full_text: completionMessage,
                                        chatid,
                                        isAdmin: false,
                                        status: updatedChat.status,
                                        objectives: this.FlowChatManager.getObjectivesSummary(chatid)
                                    };
                                }
                                
                                // CASE 2: Still have in-progress registration with remaining fields
                                else if (updatedInProgress) {
                                    const remainingFields = updatedObjective?.requiredData?.filter(
                                        f => f.required && !updatedInProgress.collectedData[f.name]
                                    ) || [];
                                    
                                    if (remainingFields.length > 0) {
                                        // Still need more fields
                                        const nextFieldPrompt = `For objective "${updatedObjective.description}":\n\n**Progress:** ${Object.keys(updatedInProgress.collectedData).length}/${updatedObjective.requiredData?.filter(f => f.required).length} fields completed\n\n`;
                                        
                                        nextFieldPrompt += "**Next, I need:**\n";
                                        remainingFields.forEach(f => {
                                            nextFieldPrompt += `• ${f.name} (${f.type}): ${f.description || 'No description'}\n`;
                                        });
                                        
                                        nextFieldPrompt += `\nPlease provide the next piece of information.`;
                                        
                                        if (tokenCallback) {
                                            for (const word of nextFieldPrompt.split(' ')) {
                                                tokenCallback(word + ' ');
                                                await EasyAI.Sleep(30);
                                            }
                                        }
                                        
                                        await this.FlowChatManager.addMessage(chatid, 'system', nextFieldPrompt);
                                        
                                        return {
                                            full_text: nextFieldPrompt,
                                            chatid,
                                            isAdmin: false,
                                            status: 'active'
                                        };
                                    } else {
                                        // All fields collected but registration still marked in-progress?
                                        // This shouldn't happen, but just in case, complete it manually
                                        updatedInProgress.status = 'completed';
                                        updatedInProgress.completedAt = Date.now();
                                        await this.FlowChatManager.saveChat(chatid);
                                        
                                        // Then show completion message
                                        let completionMessage = `✅ **Registration completed successfully for "${updatedObjective.description}"!**\n\n`;
                                        completionMessage += "**Registered information:**\n";
                                        
                                        Object.entries(updatedInProgress.collectedData).forEach(([key, data]) => {
                                            completionMessage += `• ${key}: ${data.value}\n`;
                                        });
                                        
                                        if (tokenCallback) {
                                            for (const word of completionMessage.split(' ')) {
                                                tokenCallback(word + ' ');
                                                await EasyAI.Sleep(30);
                                            }
                                        }
                                        
                                        await this.FlowChatManager.addMessage(chatid, 'system', completionMessage);
                                        
                                        return {
                                            full_text: completionMessage,
                                            chatid,
                                            isAdmin: false,
                                            status: 'active'
                                        };
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error extracting field data:', error);
                    }
                } else {
                    // No missing fields - should not happen, but if it does, show completion
                    const completionMessage = `You have already completed all required fields for "${targetObjective.description}". Would you like to start a new registration or work on another objective?`;
                    
                    if (tokenCallback) {
                        for (const word of completionMessage.split(' ')) {
                            tokenCallback(word + ' ');
                            await EasyAI.Sleep(30);
                        }
                    }
                    
                    return {
                        full_text: completionMessage,
                        chatid,
                        isAdmin: false,
                        status: 'active'
                    };
                }
            }
            
            // If we get here, continue with normal conversation for this objective
            // Set this as the current objective temporarily for the conversation
            await this.FlowChatManager.setCurrentObjective(chatid, targetObjective.id);
            
        } catch (error) {
            console.error('Error in objective detection:', error);
            // Fall back to showing all objectives
            const fallbackResponse = `I see multiple objectives available. Which one would you like to work on?\n\n${allObjectives.map((obj, idx) => `${idx + 1}. ${obj.description}`).join('\n')}`;
            
            if (tokenCallback) {
                for (const word of fallbackResponse.split(' ')) {
                    tokenCallback(word + ' ');
                    await EasyAI.Sleep(30);
                }
            }
            
            return {
                full_text: fallbackResponse,
                chatid,
                isAdmin: false,
                status: chat.status
            };
        }
    }
    
   // ========== ADMIN OBJECTIVE CREATION ==========
if (isAdmin) {
    // Try to detect if admin wants to create a new objective
    const objectiveCreationPrompt = [
        { 
            role: 'system', 
            content: `You are an objective detector. Analyze if the user is ASKING to create a new objective, not stating an objective itself.

IMPORTANT RULES:
1. The user message should be interpreted as a REQUEST to create an objective, not as the objective itself
2. Look for phrases like: "create objective", "new objective", "add objective", "I want to create", "criar objetivo", "novo objetivo"
3. If the user says something like "I want to create an objective to collect temperatures", the description should be "collect temperatures", not the whole request
4. Extract only the core purpose from their request
5. If the user is just talking generally about objectives, don't create one

Current objectives count: ${allObjectives.length}

CRITICAL FIELD NAME RULE:
- Field names MUST use underscores instead of spaces
- Example: "tipo_de_transacao" not "tipo de transação"
- Example: "nome_completo" not "nome completo"
- Example: "valor_da_compra" not "valor da compra"
- Remove accents: "transacao" not "transação"
- Use only lowercase letters, numbers, and underscores

Examples:
- User: "I want to create an objective to track user emails" → description: "track user emails", type: "form", fields: [{"name": "email", "type": "email"}]
- User: "create new objective for collecting phone numbers" → description: "collect phone numbers", type: "form", fields: [{"name": "phone", "type": "phone"}]
- User: "add a simple objective to count registrations" → description: "count registrations", type: "simple"
- User: "quero criar um novo objetivo para registrar temperaturas" → description: "registrar temperaturas", type: "form", fields: [{"name": "temperatura", "type": "number"}]
- User: "preciso coletar nome, email e telefone" → description: "coletar dados de contato", type: "form", fields: [
    {"name": "nome", "type": "text"},
    {"name": "email", "type": "email"},
    {"name": "telefone", "type": "phone"}
  ]

Respond with JSON only: {
    "isObjectiveRequest": boolean,
    "description": string or null,
    "type": "simple"|"form" or null,
    "registrationType": "single"|"multiple" or null,
    "maxRegistrations": number or null,
    "fields": array of objects with:
        - "name": string (MUST use underscores, no spaces, no accents)
        - "type": "text"|"number"|"date"|"choice"|"email"|"phone"
        - "description": string
        - "required": boolean
        - "unique": boolean
        - "options": array (only for choice type)
    or empty array,
    "needsMoreInfo": boolean,
    "clarificationQuestion": string (if needsMoreInfo)
}` 
        },
        { role: 'user', content: message }
    ];
    
    try {
        const detection = await this.Chat(objectiveCreationPrompt, { 
            temperature: 0.1, 
            response_format: { type: "json_object" } 
        });
        
        const detectionResult = JSON.parse(detection.full_text);
        
        // If needs more information, ask clarifying questions
        if (detectionResult.needsMoreInfo) {
            const clarificationResponse = detectionResult.clarificationQuestion || 
                "What kind of objective would you like to create? Please specify:\n" +
                "1. What information do you want to collect?\n" +
                "2. What type of data is it (text, number, date, etc.)?\n" +
                "3. Can users submit multiple entries or just one?\n" +
                "4. Is there a maximum number of submissions per user?";
            
            if (tokenCallback) {
                for (const word of clarificationResponse.split(' ')) {
                    tokenCallback(word + ' ');
                    await EasyAI.Sleep(30);
                }
            }
            
            await this.FlowChatManager.addMessage(chatid, 'system', clarificationResponse);
            
            return {
                full_text: clarificationResponse,
                chatid,
                isAdmin: true,
                status: chat.status
            };
        }
        
        // Only create objective if it's a clear request with sufficient details
        if (detectionResult.isObjectiveRequest && detectionResult.description) {
            
            const fields = detectionResult.fields || [];
            
            // Validate we have minimum required info
            if (detectionResult.type === 'form' && fields.length === 0) {
                // Ask for field details
                const fieldQuestion = "For this form objective, what fields do you need to collect? Please specify each field's name, type, and whether it's required.\n\n" +
                    "For example: 'name (text, required), age (number, optional), email (email, required)'\n\n" +
                    "Remember: field names should use underscores instead of spaces (e.g., 'tipo_de_transacao' not 'tipo de transação')";
                
                if (tokenCallback) {
                    for (const word of fieldQuestion.split(' ')) {
                        tokenCallback(word + ' ');
                        await EasyAI.Sleep(30);
                    }
                }
                
                return {
                    full_text: fieldQuestion,
                    chatid,
                    isAdmin: true,
                    status: chat.status
                };
            }
            
            const newObjective = await this.FlowChatManager.addObjective(chatid, id, {
                description: detectionResult.description,
                type: detectionResult.type || 'simple',
                registrationType: detectionResult.registrationType || 'multiple',
                maxRegistrations: detectionResult.maxRegistrations || null,
                fields: fields.map(f => f.name),
                requiredData: fields.map(f => ({
                    name: f.name,
                    type: f.type || 'text',
                    description: f.description || '',
                    required: f.required !== false,
                    unique: f.unique || false,
                    ...(f.type === 'choice' && f.options ? { options: f.options } : {})
                }))
            });
            
            if (newObjective) {
                const updatedSummary = this.FlowChatManager.formatObjectivesForPrompt(chatid, true, id);
                
                // Show the field names in the response
                let fieldList = '';
                if (fields.length > 0) {
                    fieldList = '\n\n**Fields created:**\n' + fields.map(f => 
                        `• ${f.name} (${f.type})${f.required ? ' required' : ''}${f.unique ? ' unique' : ''}`
                    ).join('\n');
                }
                
                const creationResponse = `✅ New objective created: "${detectionResult.description}"${fieldList}\n\n${updatedSummary}\n\nTotal active objectives: ${allObjectives.length + 1}`;
                
                if (tokenCallback) {
                    for (const word of creationResponse.split(' ')) {
                        tokenCallback(word + ' ');
                        await EasyAI.Sleep(30);
                    }
                }
                
                await this.FlowChatManager.addMessage(chatid, 'system', creationResponse);
                
                return {
                    full_text: creationResponse,
                    chatid,
                    isAdmin: true,
                    status: chat.status,
                    objectives: this.FlowChatManager.getObjectivesSummary(chatid)
                };
            }
        } else if (detectionResult.isObjectiveRequest && !detectionResult.description) {
            // They want to create an objective but didn't specify what kind
            const askResponse = "I understand you want to create a new objective. What should this objective be about? Please describe what you want to achieve or collect.";
            
            if (tokenCallback) {
                for (const word of askResponse.split(' ')) {
                    tokenCallback(word + ' ');
                    await EasyAI.Sleep(30);
                }
            }
            
            return {
                full_text: askResponse,
                chatid,
                isAdmin: true,
                status: chat.status
            };
        }
    } catch (error) {
        console.error('Error detecting objective creation:', error);
    }
}
    
    // ========== NORMAL CONVERSATION FLOW ==========
    // Build prompt based on chat status and user role
    let finalPrompt;
    let messages;
    
    if (chat.status === 'setup' && isAdmin) {
        finalPrompt = FlowChatPrompts.SETUP_MODE
            .replace('{history}', chat.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n'));
        
        messages = [
            { role: 'system', content: FlowChatPrompts.SYSTEM },
            { role: 'user', content: finalPrompt }
        ];
        
    } else if (chat.status === 'active') {
        // Enhanced prompt that shows ALL objectives and lets user choose
        const currentObjective = this.FlowChatManager.getCurrentObjective(chatid);
        
        // Build a comprehensive objectives list with user progress
        const objectivesList = allObjectives.map(obj => {
            const userRegs = obj.registrations?.filter(r => r.userId === id) || [];
            const inProgress = userRegs.find(r => r.status === 'in-progress');
            const completed = userRegs.filter(r => r.status === 'completed').length;
            
            let status = `📋 ${obj.description}`;
            if (inProgress) {
                const fieldsDone = Object.keys(inProgress.collectedData).length;
                const totalFields = obj.requiredData?.filter(f => f.required).length || 0;
                status += ` (${fieldsDone}/${totalFields} fields)`;
            } else if (completed > 0) {
                status += ` (${completed} completed)`;
            }
            
            if (obj.id === currentObjective?.id) {
                status = `👉 ${status} (current focus)`;
            }
            
            return status;
        }).join('\n');
        
        if (isAdmin) {
            finalPrompt = `You are speaking with an ADMIN user.

Current Objectives:
${objectivesList}

${allObjectives.length > 0 ? 'The admin can: work on objectives, create new ones, or manage existing ones.' : 'No objectives yet. Help admin create first objective.'}

Admin message: ${message}`;
        } else {
            finalPrompt = `You are speaking with a REGULAR user.

Available Objectives:
${objectivesList}

${allObjectives.length > 0 ? 'Guide the user to work on any objective they choose. If they mention a specific objective, help them with that one.' : 'No active objectives yet.'}

User message: ${message}`;
        }
        
        messages = [
            { role: 'system', content: FlowChatPrompts.SYSTEM },
            { role: 'user', content: finalPrompt }
        ];
        
    } else if (chat.status === 'completed') {
        finalPrompt = FlowChatPrompts.COMPLETED_MODE.replace('{message}', message);
        messages = [
            { role: 'system', content: FlowChatPrompts.SYSTEM },
            { role: 'user', content: finalPrompt }
        ];
    }
    
    // Generate response
    if (!messages) {
        messages = [
            { role: 'system', content: FlowChatPrompts.SYSTEM },
            { role: 'user', content: message }
        ];
    }
    
    const response = await this.Chat(messages, {
        stream: !!tokenCallback,
        tokenCallback,
        temperature: 0.7,
        max_tokens: 800
    });
    
    // Save response
    if (response && response.full_text) {
        await this.FlowChatManager.addMessage(chatid, 'assistant', response.full_text);
    }
    
    return {
        ...response,
        chatid,
        isAdmin,
        status: chat.status,
        objectives: this.FlowChatManager.getObjectivesSummary(chatid)
    };
}

// Helper method to format progress for a single objective
formatSingleObjectiveProgress(objective, userId) {
    if (!objective) return '';
    
    const userRegs = objective.registrations?.filter(r => r.userId === userId) || [];
    const inProgress = userRegs.find(r => r.status === 'in-progress');
    const completed = userRegs.filter(r => r.status === 'completed').length;
    
    let output = `📋 **${objective.description}**\n`;
    
    if (inProgress) {
        output += `   In Progress:\n`;
        Object.entries(inProgress.collectedData).forEach(([key, data]) => {
            output += `   - ${key}: ${data.value}\n`;
        });
        
        const missingFields = objective.requiredData?.filter(f => 
            f.required && !inProgress.collectedData[f.name]
        ) || [];
        
        if (missingFields.length > 0) {
            output += `   Still need:\n`;
            missingFields.forEach(f => {
                output += `   - ${f.name} (${f.type})\n`;
            });
        }
    } else if (completed > 0) {
        output += `   Completed: ${completed} registration(s)\n`;
    }
    
    return output;
}

// Helper method to format progress for a single objective
formatSingleObjectiveProgress(objective, userId) {
    if (!objective) return '';
    
    const userRegs = objective.registrations?.filter(r => r.userId === userId) || [];
    const inProgress = userRegs.find(r => r.status === 'in-progress');
    const completed = userRegs.filter(r => r.status === 'completed').length;
    
    let output = `📋 **${objective.description}**\n`;
    
    if (inProgress) {
        output += `   In Progress:\n`;
        Object.entries(inProgress.collectedData).forEach(([key, data]) => {
            output += `   - ${key}: ${data.value}\n`;
        });
        
        const missingFields = objective.requiredData?.filter(f => 
            f.required && !inProgress.collectedData[f.name]
        ) || [];
        
        if (missingFields.length > 0) {
            output += `   Still need:\n`;
            missingFields.forEach(f => {
                output += `   - ${f.name} (${f.type})\n`;
            });
        }
    } else if (completed > 0) {
        output += `   Completed: ${completed} registration(s)\n`;
    }
    
    return output;
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