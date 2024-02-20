import EasyAI from '../../../EasyAI.js'
import StartMenu from '../StartMenu.js'
import SetupMenu from '../MenuCLI.js'

const SandboxMenu = () => ({
    title : `• Sandbox •
`,
options : [
    {
    name : 'Servidor Local',
    action : () => {
    }
    },
    {
    name : 'Servidor Remoto',
    action : () => {
        }
        },
    {
        name : '← Voltar',
        action : () => {
            SetupMenu.displayMenu(StartMenu)
            }
        }
     ]

})



export default SandboxMenu