import EasyAI from '../../EasyAI.js'
import StartMenu from './StartMenu.js'
import MenuCLI from './MenuCLI.js'
import ServerSaves from './ServerSaves.js'
import ModelsList from './ModelsList.js'
import ColorText from '../useful/ColorText.js'
import ConfigManager from '../ConfigManager.js'
import PM2 from '../useful/PM2.js'

let easyai_config = {}
let easyai_token = undefined
let easyai_port = 4000
let withPM2 = false

let models_options = async () => {
    let final_array = []
    let saves_array = await ModelsList()
    saves_array.forEach(e => {
        final_array.push({
            name : `${e.name} | ${e.size} GB`,
            action : async () => {
                if(easyai_config.llama){
                    easyai_config.llama.llama_model = `./models/${e.name}`
                } else {
                    easyai_config.llama = {}
                    easyai_config.llama.llama_model = `./models/${e.name}`
                }
                MenuCLI.displayMenu(CustomServer)
                }
            })
    })
final_array.push({
    name : '← Voltar',
    action : () => {
        MenuCLI.displayMenu(CustomServer)
        }
    })
return final_array
}

let save_options = async (delmenu = false) => {
    let final_array = []
    let saves_array = await ServerSaves.List()
    saves_array.forEach(e => {
        final_array.push({
            name : `${delmenu ? '❌ ' : ''}${e}`,
            action : async () => {
                if(!delmenu){
                let save = await ServerSaves.Load(e)
                easyai_config = save.EasyAI_Config || {}
                easyai_port = save.Port || 4000
                easyai_token = save.Token || undefined
                withPM2 = save.PM2
                MenuCLI.displayMenu(CustomServer)
                } else {
                    let response = await MenuCLI.displayMenuFromOptions(`Confirm delete of ${ColorText.cyan(e)}? This is ${ColorText.red('irreversible.')}`,[ColorText.green('yes'),ColorText.red('no')])
                    if(response == ColorText.green('yes')){await ServerSaves.Delete(e)}  
                    MenuCLI.displayMenu(SavesMenu,{props : {options : await save_options(true)}})
                }
                }
            })
    })
if(!delmenu){
    final_array.push({
        name : '❌ Excluir Save ❌',
        action : async () => {
            MenuCLI.displayMenu(SavesMenu,{props : {options : await save_options(true)}})
            }
        })
}
final_array.push({
    name : `← Voltar ${delmenu ? '- Carregar Save' : ''}`,
    action : async () => {
        if(!delmenu){MenuCLI.displayMenu(ServerMenu)} else {MenuCLI.displayMenu(SavesMenu,{props : {options : await save_options()}})}
        }
    })
return final_array
}

const CustomServer = (props) => ({
    title : `• EasyAI Server | Configurar Server
${(props.save_message) ? `
${props.save_message}
` : ''}`,
options : [
    {
    name : ColorText.yellow('⚡ Iniciar Servidor ⚡'),
    action : async () => {

        if(withPM2){
            await EasyAI.Server.PM2({token : easyai_token,port : easyai_port,EasyAI_Config : easyai_config})
            MenuCLI.displayMenu(ServerMenu,{alert_emoji : '✔️',alert : 'PM2 Server iniciado com sucesso !'})

        } else {
            let server = new EasyAI.Server({token : easyai_token,port : easyai_port,EasyAI_Config : easyai_config})
            server.start()
        }

        

        
    }
    },
    {
        name : `EasyAI PORT | ${easyai_port}`,
        action : async () => {
            let newport = await MenuCLI.ask('Digite a nova PORTA : ')
            easyai_port = newport
            MenuCLI.displayMenu(CustomServer)    
        }
        },
        {
            name : `LlamaCPP PORT | ${easyai_config.llama ? (easyai_config.llama.server_port ? easyai_config.llama.server_port : '8080') : '8080'}`,
            action : async () => {
                let newport = await MenuCLI.ask('Digite a nova PORTA : ')
                if(easyai_config.llama){
                    easyai_config.llama.server_port = newport
                } else {
                    easyai_config.llama = {}
                    easyai_config.llama.server_port = newport
                }
                MenuCLI.displayMenu(CustomServer) 
            }
            },
            {
            name : `PM2 | ${withPM2 ? ColorText.green('ON') : ColorText.red('OFF')}`,
            action : async () => {
                if(withPM2){
                    withPM2 = false
                } else {
                    withPM2 = true
                }
                MenuCLI.displayMenu(CustomServer) 
            }
            },
            {
                name : (easyai_token) ? ColorText.green('Access Token') : ColorText.red('Access Token'),
                action : async  () => {
                    if(easyai_token){
                        let response = await MenuCLI.ask('Edit Token',{options : ['New Token','Clear Token','Cancel']})
                        switch (response) {
                            case 'New Token':
                                let token =  await MenuCLI.ask('Set Token : ')
                                easyai_token = token
                                MenuCLI.displayMenu(CustomServer)
                            break;

                            case 'Clear Token':
                                easyai_token = undefined
                                MenuCLI.displayMenu(CustomServer)
                            break;
                        
                            default:
                                MenuCLI.displayMenu(CustomServer)
                            break;
                        }
                    } else {
                        let token =  await MenuCLI.ask('Set Token : ')
                        easyai_token = token
                        MenuCLI.displayMenu(CustomServer)
                    }
                    
                    }
        },
            {
                name : `Threads | ${easyai_config.llama ? (easyai_config.llama.threads ? ColorText.magenta(easyai_config.llama.threads) : ColorText.green('MAX')) : ColorText.green('MAX')}`,
                action : async () => {
                    let newthreads = await MenuCLI.ask('Qntd. Threads : ')
                    if(easyai_config.llama){
                        easyai_config.llama.threads = Number(newthreads)
                    } else {
                        easyai_config.llama = {}
                        easyai_config.llama.threads = Number(newthreads)
                    }
                    MenuCLI.displayMenu(CustomServer) 
                }
                },
    {
    name : `CUDA | ${easyai_config.llama ? (easyai_config.llama.cuda ? ColorText.green('ON') : ColorText.red('OFF')) : ColorText.red('OFF')}`,
    action : () => {
                if(easyai_config.llama){
                    if(easyai_config.llama.cuda){
                        easyai_config.llama.cuda = false
                    } else {
                        easyai_config.llama.cuda = true
                    }
                } else {
                    easyai_config.llama = {}
                    easyai_config.llama.cuda = true
                }
                MenuCLI.displayMenu(CustomServer)
            }
    },
    {
        name : `Selecionar Modelo ${easyai_config.llama ? (easyai_config.llama.llama_model ?  `| ${easyai_config.llama.llama_model}` : '') : ''}`,
        action : async  () => {
            MenuCLI.displayMenu(ModelsMenu,{props : {options : await models_options()}})
                }
        },
    {
        name : '📑 SALVAR CONFIGURAÇÕES',
        action : async  () => {
                let name =  await MenuCLI.ask('Qual nome deseja inserir ? : ')
                 await ServerSaves.Save(name,{pm2 : withPM2,token : easyai_token,port : easyai_port,EasyAI_Config : easyai_config})
                 .then(() => {
                    MenuCLI.displayMenu(CustomServer,{props : {save_message : '✔️ Configurações salvas com sucesso !'}})
                 })
                 .catch(e => {
                    MenuCLI.displayMenu(CustomServer,{props : {save_message : '⛔ Erro ao salvar as configurações'}})
                 })
            }
        },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(ServerMenu)
            }
        }
     ]

})


let server_menu_options = async () => {

    let opt_array = [
    {
    name : ColorText.yellow('⚡ Inicio Rápido'),
    action : () => {
        easyai_config = {}
        if(ConfigManager.getKey('start-cuda')){
            easyai_config.llama = {}
            easyai_config.llama.cuda = true
        }
        if(ConfigManager.getKey('start-pm2')){
           withPM2 = true
        }
        let server = new EasyAI.Server({EasyAI_Config : easyai_config})
        server.start()
    }
    },
    {
    name : '✏️ Inicio Personalizado',
    action : () => {
        easyai_config = {}
        if(ConfigManager.getKey('start-cuda')){
            easyai_config.llama = {}
            easyai_config.llama.cuda = true
        }
        if(ConfigManager.getKey('start-pm2')){
            withPM2 = true
         } else {
            withPM2 = false
         }
        easyai_port = 4000
        easyai_token = undefined
        MenuCLI.displayMenu(CustomServer)
        }
    },
    {
        name : '📁 Saves',
        action : async () => {
            MenuCLI.displayMenu(SavesMenu,{props : {options : await save_options()}})
            }
        }
    
     ]

     if(await PM2.Process('pm2_easyai_server').catch(e =>{})){
        opt_array.push({
            name : ColorText.red('❌ Close PM2 Server'),
            action : async () => {
                await PM2.Delete('pm2_easyai_server')
                MenuCLI.displayMenu(ServerMenu)
                }
            })
     }

     opt_array.push({
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(StartMenu)
            }
        })
    
    return opt_array
    }

const ServerMenu = async () => ({
    title : `• EasyAI Server • ${(await PM2.Process('pm2_easyai_server').catch(e => {})) ? `| ${ColorText.green('PM2 Server Online')}` : ''}
`,
options : await server_menu_options()

})

const SavesMenu = (props) => ({
    title : `• Saves •
`,
options : props.options
})

const ModelsMenu = (props) => ({
    title : `• Modelos •
`,
options : props.options
})

export default ServerMenu