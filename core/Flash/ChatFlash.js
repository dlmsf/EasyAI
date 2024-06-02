#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import Chat from "../ChatModule/Chat.js"
import TerminalChat from "../TerminalChat.js"
import ChatPrompt from "../MenuCLI/Sandbox/ChatPrompt.js"
import PM2 from "../useful/PM2.js"

await EasyAI.Server.PM2()
let ai = new EasyAI({server_url : 'localhost',server_port : 4000})
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