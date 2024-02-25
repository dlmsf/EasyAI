import EasyAI from '../../EasyAI.js'
import StartMenu from './StartMenu.js'
import MenuCLI from './MenuCLI.js'

let easyai_config = {}

const CustomServer = () => ({
    title : `• EasyAI Server | Configurar Server
`,
options : [
    {
    name : '⚡ Iniciar Servidor ⚡',
    action : () => {
        if(easyai_config == {}){
            let server = new EasyAI.Server()
            server.start()
        } else {
            let server = new EasyAI.Server(easyai_config)
            server.start()
        }
    }
    },
    {
    name : `CUDA ${easyai_config.llama ? (easyai_config.llama.cuda ? '✔️' : '❌') : '❌'}`,
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
    name : '⚡ Inicio Rápido',
    action : () => {
        let server = new EasyAI.Server()
        server.start()
    }
    },
    {
    name : '✏️ Inicio Personalizado',
    action : () => {
        easyai_config = {}
        MenuCLI.displayMenu(CustomServer)
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

export default ServerMenu