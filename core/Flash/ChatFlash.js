#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import Chat from "../ChatModule/Chat.js"
import TerminalChat from "../TerminalChat.js"
import ChatPrompt from "../MenuCLI/Sandbox/ChatPrompt.js"
import PM2 from "../useful/PM2.js"
import ServerSaves from "../MenuCLI/ServerSaves.js"
import ConfigManager from "../ConfigManager.js"
import ColorText from '../useful/ColorText.js'

let ai

const args = process.argv.slice(2);

if (args.length > 0 || ConfigManager.getKey('defaultchatsave')){
    await ServerSaves.Load((args.length > 0) ? args[0] : ConfigManager.getKey('defaultchatsave'))
    .then(async (save) => {

            await EasyAI.Server.PM2({token : save.Token,port : save.Port,EasyAI_Config : save.EasyAI_Config})
            console.log('✔️ PM2 Server iniciado com sucesso !')
            ai = new EasyAI({server_url : 'localhost',server_port : 4000})

    }).catch(async e => {

        console.log(`Save ${ColorText.red(args[0])} não foi encontrado`)
        await EasyAI.Server.PM2()
        ai = new EasyAI({server_url : 'localhost',server_port : 4000})
   
    })
} else {
    await EasyAI.Server.PM2()
    ai = new EasyAI({server_url : 'localhost',server_port : 4000})
}

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
            await PM2.Delete('pm2_easyai_server')
        }})