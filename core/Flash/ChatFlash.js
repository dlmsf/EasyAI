#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import Chat from "../ChatModule/Chat.js"
import TerminalChat from "../TerminalChat.js"
import ChatPrompt from "../MenuCLI/Sandbox/ChatPrompt.js"
import PM2 from "../useful/PM2.js"
import ServerSaves from "../MenuCLI/ServerSaves.js"
import ConfigManager from "../ConfigManager.js"
import ColorText from '../useful/ColorText.js'
import TerminalHUD from "../TerminalHUD.js"
import ModelsList from '../MenuCLI/ModelsList.js'
import FreePort from "../useful/FreePort.js"

let ai
let process_name
let port

process.on('exit',() =>{console.clear()})

const StartChat = (ai,process_name) => {
    const chat = new Chat()
    console.clear()
    
            new TerminalChat(async (input,displayToken) => {
                chat.NewMessage('User: ',input)
                let historical_prompt = ''
                chat.Historical.forEach(e => {
                 historical_prompt = `${historical_prompt}${e.Sender}${e.Content} | `
                })
                let result = await ai.Generate(`${ChatPrompt}${historical_prompt}AI:`,{tokenCallback : async (token) => {await displayToken(token.stream.content)},stop : ['|']})
                chat.NewMessage('AI: ',result.full_text)
            },{exitFunction : async () => {
                if(process_name){
                await PM2.Delete(process_name)
                }
                console.clear()
                process.exit(0)
            }})
}

let models_options = async () => {
    let final_array = []
    let saves_array = await ModelsList()
    saves_array.forEach(e => {
        final_array.push({
            name : `${e.name} | ${e.size} GB`,
            action : async () => {
              
               let model = `./models/${e.name}`
               port = await FreePort(4000)
               process_name = await EasyAI.Server.PM2({handle_port : false,port : port,EasyAI_Config :{llama : {llama_model : model}}})
                
                }
            })
    })
final_array.push({
    name : 'Exit',
    action : () => {
        console.clear()
        process.exit()
        }
    })
return final_array
}

const FastModel = async () => ({

    options : await models_options()

})

const args = process.argv.slice(2);

if (args.length > 0 || ConfigManager.getKey('defaultchatsave')){
    let toload = (args.length > 0) ? args[0] : ConfigManager.getKey('defaultchatsave')
    if(toload.toLowerCase() == 'openai' || toload.toLowerCase() == 'deepinfra'){
        if(ConfigManager.getKey('openai') || ConfigManager.getKey('deepinfra')){
            if(ConfigManager.getKey('openai')){
                let openai_info = ConfigManager.getKey('openai')
                ai = new EasyAI({openai_token : openai_info.token, openai_model : openai_info.model})
                StartChat(ai)
            } else {
                let deepinfra_info = ConfigManager.getKey('deepinfra')
                ai = new EasyAI({deepinfra_token : deepinfra_info.token, deepinfra_model : deepinfra_info.model})
                StartChat(ai)
            }
        } else {
            
            let cli = new TerminalHUD()
            let final_object = {}
            let ok = false
            let external = ''

            if(toload.toLowerCase() == 'openai'){
                final_object.token = await cli.ask('OpenAI Token : ')
                final_object.model = await cli.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
                let save = await cli.ask('Save the OpenAI config? ',{options : ['yes','no']})
                if(save == 'yes'){ConfigManager.setKey('openai',final_object)}
                cli.close()
                console.clear()
                ai = new EasyAI({openai_token : final_object.token, openai_model : final_object.model})
                StartChat(ai)
            } else if(toload.toLowerCase() == 'deepinfra'){
                final_object.token = await cli.ask('DeepInfra Token : ')
                final_object.model = await cli.ask('Select the model',{options : [
                    'deepseek-ai/DeepSeek-V3.2',
                    'meta-llama/Meta-Llama-3.1-8B-Instruct',
                    'Qwen/Qwen3-235B-A22B-Instruct-2507',
                    'zai-org/GLM-4.7-Flash'
                ]})
                let save = await cli.ask('Save the DeepInfra config? ',{options : ['yes','no']})
                if(save == 'yes'){ConfigManager.setKey('deepinfra',final_object)}
                cli.close()
                console.clear()
                ai = new EasyAI({deepinfra_token : final_object.token, deepinfra_model : final_object.model})
                StartChat(ai)
            }

            /*
            while(!ok){
                let selection = await cli.ask('1. OpenAI | 2. DeepInfra : ')
                let num_selection = Number(selection)
                if(typeof num_selection == 'number'){
                    if(num_selection == 1){
                        
                    } else if(num_selection){
                        
                    }
                }
            }
            */
        }
    } else {
        await ServerSaves.Load(toload)
        .then(async (save) => {

                process_name = await EasyAI.Server.PM2({handle_port : false,token : save.Token,port : save.Port,EasyAI_Config : save.EasyAI_Config})
                console.log('✔️ PM2 Server iniciado com sucesso !')
                ai = new EasyAI({server_url : 'localhost',server_port : save.Port})
                StartChat(ai,process_name)
    
        }).catch(async e => {
            
            if(args[0] == "models"){
                let cli = new TerminalHUD()
                await cli.displayMenu(FastModel)
                cli.close()
                ai = new EasyAI({server_url : 'localhost',server_port : port})
                StartChat(ai,process_name)

            } else {
                console.log(`Save ${ColorText.red(args[0])} não foi encontrado`)
                port = await FreePort(4000)
                process_name = await EasyAI.Server.PM2({handle_port : false,port : port})
                ai = new EasyAI({server_url : 'localhost',server_port : port})
                StartChat(ai,process_name)
           
            } 
        })
    }
   
} else {
    port = await FreePort(4000)
    process_name = await EasyAI.Server.PM2({handle_port : false,port : port})
    ai = new EasyAI({server_url : 'localhost',server_port : port})
    StartChat(ai,process_name)
}

