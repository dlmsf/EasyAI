import EasyAI from '../../../EasyAI.js'
import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'

const SandboxMenu = (props) => ({
    title : `☕ Sandbox | ${props.server_url}
`,
options : [
    {
    name : 'Generate',
    action : async () => {
        let prompt = await MenuCLI.ask('Prompt : ')
        let ai = new EasyAI(props)
        await ai.Generate(prompt,{tokenCallback : (token) => {console.log(token)}})
        MenuCLI.displayMenu(SandboxMenu,{props : props})
    }
    },
    {
    name : 'ChatGPT',
    action : () => {
        }
    },
    {
    name : 'Coder',
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



export default SandboxMenu