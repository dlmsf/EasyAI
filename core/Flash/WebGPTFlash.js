#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import PM2 from "../useful/PM2.js"
import TerminalHUD from "../TerminalHUD.js"


if(await PM2.Process('pm2_webgpt')){
    let cli = new TerminalHUD()

    let menu = () => ({
        title : 'Flash WebGPT',
        options : [
            {
            name : '❌ Finalizar WebGPT',
            action : async () =>{
                console.clear()
                await PM2.Delete('pm2_webgpt pm2_easyai_server')
                process.exit()
            }
            },
            {
            name : 'Sair',
            action : () => {
                console.clear()
                process.exit()
                }
            }

        ]
    })

    cli.displayMenu(menu)

} else {
    await EasyAI.Server.PM2()
    await EasyAI.WebGPT.PM2()
    process.exit()
}

