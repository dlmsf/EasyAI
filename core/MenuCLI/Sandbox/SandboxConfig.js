import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'
import SandboxMenu from './SandboxMenu.js'

let instance_config = {server_url : 'localhost'}

const SandboxConfig = () => ({
    title : `• Sandbox Config •

URL : ${instance_config.server_url}
`,
options : [
    {
        name : '✅ Conectar',
        action : () => {
            MenuCLI.displayMenu(SandboxMenu,{props : instance_config})
        }
        },
    {
    name : `Alterar URL`,
    action : () => {
    }
    },
    {
    name : 'Configurar Porta',
    action : () => {
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