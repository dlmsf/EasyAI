#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import TerminalGenerate from "../TerminalGenerate.js"
import PM2 from "../useful/PM2.js"

let ai

const args = process.argv.slice(2);

if (args.length > 0) {
    await ServerSaves.Load(args[0])
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


console.clear()

        new TerminalGenerate(async (input,display) => {
           await ai.Generate(input,{tokenCallback : async (token) =>{await display(token.stream.content)}})
        },{exitFunction : async () => {
            await PM2.Delete('pm2_easyai_server')
        }})