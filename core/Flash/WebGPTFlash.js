#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import PM2 from "../useful/PM2.js"
import TerminalHUD from "../TerminalHUD.js"
import ServerSaves from "../MenuCLI/ServerSaves.js"


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

const args = process.argv.slice(2);

if (args.length > 0) {
    await ServerSaves.Load(args[0])
    .then(async (save) => {

            await EasyAI.Server.PM2({token : save.Token,port : save.Port,EasyAI_Config : save.EasyAI_Config})
            console.log('✔️ PM2 Server iniciado com sucesso !')
            await EasyAI.WebGPT.PM2()

    }).catch(async e => {

        console.log(`Save ${ColorText.red(args[0])} não foi encontrado`)
        await EasyAI.Server.PM2()
        await EasyAI.WebGPT.PM2()
   
    })
} else {
    await EasyAI.Server.PM2()
    await EasyAI.WebGPT.PM2()
    process.exit()
}


}