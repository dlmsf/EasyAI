import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'
import SandboxMenu from './SandboxMenu.js'

let instance_config = {server_url : 'localhost',server_port : 4000}

const SandboxConfig = () => ({
    title : `• Sandbox Config •

${instance_config.openai ? 'OpenAI': `URL : ${instance_config.server_url}${(instance_config.server_port) ? `:${instance_config.server_port}` : ''}`}
`,
options : [
    {
        name : '✅ Conectar ✅',
        action : () => {
            MenuCLI.displayMenu(SandboxMenu,{props : instance_config})
        }
        },
    {
    name : `Configurar URL`,
    action : async () => {
        let newurl = await MenuCLI.ask('Novo URL : ')
        delete instance_config.openai
        instance_config.server_url = newurl
        delete instance_config.server_port
        MenuCLI.displayMenu(SandboxConfig)
    }
    },
    {
    name : 'Configurar Porta',
    action : async () => {
        let newport = await MenuCLI.ask('Nova Porta : ')
        instance_config.server_port = newport
        MenuCLI.displayMenu(SandboxConfig)
    }
    },
    {
        name : '🌟 OpenAI',
        action : async () => {
            let token = await MenuCLI.ask('OpenAI Token : ')
            instance_config.openai = token
            MenuCLI.displayMenu(SandboxConfig)
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



export default SandboxConfig