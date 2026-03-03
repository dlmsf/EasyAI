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

// Add this method to your EasyAI class

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
        const initialResponse = "Welcome! I'm your AI assistant for managing chat objectives. As the admin, you can create objectives for our conversation. Would you like to create your first objective? You can say 'create objective' to get started, or just chat normally.";
        
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
            isAdmin: true
        };
    }

    // Add user message to history
    await this.FlowChatManager.addMessage(chatid, id, message);
    
    const isAdmin = this.FlowChatManager.isAdmin(chatid, id);
    const objectivesSummary = this.FlowChatManager.formatObjectivesForPrompt(chatid);
    
    // Detect commands and mode switches
    const lowerMessage = message.toLowerCase();
    let mode = chat.mode;
    let commandResponse = null;
    
    // Check for admin commands
    if (isAdmin) {
        // Command detection
        if (FlowChatPrompts.COMMANDS.CREATE.some(cmd => lowerMessage.includes(cmd))) {
            mode = 'creation';
            commandResponse = FlowChatPrompts.OBJECTIVE_CREATION
                .replace('{objectives}', objectivesSummary)
                .replace('{history}', chat.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n'));
        }
        else if (FlowChatPrompts.COMMANDS.LIST.some(cmd => lowerMessage.includes(cmd))) {
            const summary = this.FlowChatManager.getObjectivesSummary(chatid);
            commandResponse = FlowChatPrompts.OBJECTIVE_SUMMARY
                .replace('{objectives}', objectivesSummary)
                .replace('{total}', summary.total)
                .replace('{completed}', summary.completed)
                .replace('{inProgress}', summary.inProgress);
        }
        else if (FlowChatPrompts.COMMANDS.SWITCH_TO_MANAGEMENT.some(cmd => lowerMessage.includes(cmd))) {
            mode = 'management';
            commandResponse = FlowChatPrompts.OBJECTIVE_MANAGEMENT
                .replace('{objectives}', objectivesSummary)
                .replace('{message}', message);
        }
        else if (FlowChatPrompts.COMMANDS.SWITCH_TO_NORMAL.some(cmd => lowerMessage.includes(cmd))) {
            mode = 'normal';
            commandResponse = "Switched to normal conversation mode. I'll keep your objectives in mind while we chat.";
        }
        else if (FlowChatPrompts.COMMANDS.COMPLETE.some(cmd => lowerMessage.includes(cmd))) {
            // Extract objective ID from message
            const match = message.match(/(?:complete|finish|done with)\s+(\w+)/i);
            if (match && match[1]) {
                await this.FlowChatManager.completeObjective(chatid, id, match[1]);
                commandResponse = `Objective ${match[1]} marked as completed!`;
            }
        }
        else if (FlowChatPrompts.COMMANDS.DELETE.some(cmd => lowerMessage.includes(cmd))) {
            const match = message.match(/(?:delete|remove)\s+(\w+)/i);
            if (match && match[1]) {
                await this.FlowChatManager.deleteObjective(chatid, id, match[1]);
                commandResponse = `Objective ${match[1]} removed.`;
            }
        }
        
        // Handle objective creation flow
        if (mode === 'creation' && !commandResponse) {
            if (!chat.context.pendingCreation) {
                // Start objective creation
                chat.context.pendingCreation = { step: 'description' };
                commandResponse = "Great! What objective would you like to create? Please describe it clearly.";
            } else {
                // Complete objective creation
                const newObjective = await this.FlowChatManager.addObjective(chatid, id, message);
                chat.context.pendingCreation = null;
                mode = 'normal';
                commandResponse = `✅ Objective created: "${message}"\n\nCurrent objectives:\n${this.FlowChatManager.formatObjectivesForPrompt(chatid)}`;
            }
        }
    }
    
    // Update chat mode
    this.FlowChatManager.setMode(chatid, mode);
    
    // Build prompt based on mode and user role
    let finalPrompt;
    
    if (commandResponse) {
        // If it's a command response, use it directly
        if (tokenCallback) {
            for (const word of commandResponse.split(' ')) {
                tokenCallback(word + ' ');
                await EasyAI.Sleep(30);
            }
        }
        
        await this.FlowChatManager.addMessage(chatid, 'system', commandResponse);
        
        return {
            full_text: commandResponse,
            chatid,
            isAdmin
        };
    }
    
    if (!isAdmin) {
        // Regular user response
        finalPrompt = FlowChatPrompts.USER_RESPONSE
            .replace('{objectives}', objectivesSummary)
            .replace('{message}', message);
    } else {
        // Admin response based on mode
        switch (mode) {
            case 'management':
                finalPrompt = FlowChatPrompts.OBJECTIVE_MANAGEMENT
                    .replace('{objectives}', objectivesSummary)
                    .replace('{message}', message);
                break;
            case 'creation':
                finalPrompt = FlowChatPrompts.OBJECTIVE_CREATION
                    .replace('{objectives}', objectivesSummary)
                    .replace('{history}', chat.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n'));
                break;
            default:
                finalPrompt = FlowChatPrompts.NORMAL_CONVERSATION
                    .replace('{objectives}', objectivesSummary)
                    .replace('{message}', message);
        }
    }
    
    // Add system context
    const messages = [
        { role: 'system', content: FlowChatPrompts.SYSTEM },
        { role: 'user', content: finalPrompt }
    ];
    
    // Generate response
    const response = await this.Chat(messages, {
        stream: !!tokenCallback,
        tokenCallback,
        temperature: 0.7,
        max_tokens: 500
    });
    
    // Save response to chat history
    if (response && response.full_text) {
        await this.FlowChatManager.addMessage(chatid, 'assistant', response.full_text);
    }
    
    // Check for objective updates in natural conversation
    if (isAdmin && response.full_text && response.full_text.toLowerCase().includes('objective completed')) {
        // Auto-detect objective completion mentions
        const objectives = this.FlowChatManager.getObjectivesSummary(chatid);
        if (objectives && objectives.objectives.length > 0) {
            const activeObjectives = objectives.objectives.filter(obj => obj.status === 'active');
            for (const obj of activeObjectives) {
                if (response.full_text.toLowerCase().includes(obj.description.toLowerCase().substring(0, 20))) {
                    await this.FlowChatManager.completeObjective(chatid, id, obj.id);
                }
            }
        }
    }
    
    return {
        ...response,
        chatid,
        isAdmin,
        objectives: this.FlowChatManager.getObjectivesSummary(chatid)
    };
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