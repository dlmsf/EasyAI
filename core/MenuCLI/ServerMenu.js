import EasyAI from '../../EasyAI.js'
import StartMenu from './StartMenu.js'
import MenuCLI from './MenuCLI.js'

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