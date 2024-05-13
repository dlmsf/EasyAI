import EasyAI from '../../EasyAI.js'
import StartMenu from './StartMenu.js'
import MenuCLI from './MenuCLI.js'
import ServerSaves from './ServerSaves.js'
import ModelsList from './ModelsList.js'
import ColorText from '../useful/ColorText.js'
import ConfigManager from '../ConfigManager.js'

let easyai_config = {}
let easyai_port = 4000

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
                MenuCLI.displayMenu(CustomServer)
                } else {
                    await ServerSaves.Delete(e)
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
    action : () => {
        let server = new EasyAI.Server({port : easyai_port,EasyAI_Config : easyai_config})
        server.start()
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
                 await ServerSaves.Save(name,{port : easyai_port,EasyAI_Config : easyai_config})
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

const ServerMenu = () => ({
    title : `• EasyAI Server •
`,
options : [
    {
    name : ColorText.yellow('⚡ Inicio Rápido'),
    action : () => {
        easyai_config = {}
        if(ConfigManager.getKey('start-cuda')){
            easyai_config.llama = {}
            easyai_config.llama.cuda = true
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
        easyai_port = 4000
        MenuCLI.displayMenu(CustomServer)
        }
    },
    {
        name : '📁 Saves',
        action : async () => {
            MenuCLI.displayMenu(SavesMenu,{props : {options : await save_options()}})
            }
        },
    {
        name : '← Voltar',
        action : () => {
            MenuCLI.displayMenu(StartMenu)
            }
        }
     ]

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