#!/usr/bin/env node

import EasyAI from "../../EasyAI.js"
import PM2 from "../useful/PM2.js"
import TerminalHUD from "../TerminalHUD.js"
import ServerSaves from "../MenuCLI/ServerSaves.js"
import ColorText from '../useful/ColorText.js'
import ConfigManager from "../ConfigManager.js"


if(ConfigManager.getKey('flash_webgpt_aiprocess') || ConfigManager.getKey('flash_webgpt_process')){
    let cli = new TerminalHUD()

    let menu = () => ({
        title : 'Flash WebGPT',
        options : [
            {
            name : '❌ Close Webgpt',
            action : async () =>{
                console.clear()
                await PM2.Delete(ConfigManager.getKey('flash_webgpt_process')).catch(e => {})
                await PM2.Delete(ConfigManager.getKey('flash_webgpt_aiprocess')).catch(e => {})
                console.clear()
                console.log('Done.')
                process.exit()
            }
            },
            {
            name : 'Exit',
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

if (args.length > 0 || ConfigManager.getKey('defaultwebgptsave')) {
    let toload = (args.length > 0) ? args[0] : ConfigManager.getKey('defaultwebgptsave')
    if(toload.toLowerCase() == 'openai'){
        if(ConfigManager.getKey('openai')){
            let openai_info = ConfigManager.getKey('openai')
            await EasyAI.WebGPT.PM2({openai_token : openai_info.token, openai_model : openai_info.model})
            .then(name => {ConfigManager.setKey('flash_webgpt_process',name)})
        } else {
            let cli = new TerminalHUD()
            let final_object = {}
            final_object.token = await cli.ask('OpenAI Token : ')
            final_object.model = await cli.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
            let save = await cli.ask('Save the OpenAI config? ',{options : ['yes','no']})
            if(save == 'yes'){ConfigManager.setKey('openai',final_object)}
            cli.close(
            console.clear()
            )
            await EasyAI.WebGPT.PM2({openai_token : final_object.token, openai_model : final_object.model})
            .then(name => {ConfigManager.setKey('flash_webgpt_process',name)})
        }
    } else {
    await ServerSaves.Load(toload)
    .then(async (save) => {

            await EasyAI.Server.PM2({token : save.Token,port : save.Port,EasyAI_Config : save.EasyAI_Config})
            .then(name => {ConfigManager.setKey('flash_webgpt_aiprocess',name)})
            
            console.log('✔️ PM2 Server iniciado com sucesso !')
            await EasyAI.WebGPT.PM2({port : save.Webgpt_Port,easyai_port : save.Port})
            .then(name => {ConfigManager.setKey('flash_webgpt_process',name)})

    }).catch(async e => {

        console.log(`Save ${ColorText.red(args[0])} não foi encontrado`)
        await EasyAI.Server.PM2()
        .then(name => {ConfigManager.setKey('flash_webgpt_aiprocess',name)})
        await EasyAI.WebGPT.PM2()
        .then(name => {ConfigManager.setKey('flash_webgpt_process',name)})
   
    })
}
} else {
    await EasyAI.Server.PM2()
    .then(name => {ConfigManager.setKey('flash_webgpt_aiprocess',name)})
    await EasyAI.WebGPT.PM2()
    .then(name => {ConfigManager.setKey('flash_webgpt_process',name)})
    process.exit()
}


}