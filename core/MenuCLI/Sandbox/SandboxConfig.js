import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'


const SandboxConfig = () => ({
    title : `• Sandbox Config •
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
            MenuCLI.displayMenu(StartMenu)
            }
        }
     ]

})



export default SandboxConfig