import EasyAI from '../../../EasyAI.js'
import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'
import TerminalChat from '../../TerminalChat.js'
import ChatPrompt from './ChatPrompt.js'
import readline from 'readline';
import Chat from '../../ChatModule/Chat.js'


const SandboxMenu = (props) => ({
    title : `☕ Sandbox | ${props.openai_token ? 'OpenAI' : `${props.server_url}${(props.server_port) ? `:${props.server_port}` : ''}`}
`,
options : [
    {
    name : 'Generate',
    action : async () => {
        let ai = new EasyAI(props)
        let prompt = ''
        while(prompt != 'exit' || prompt != 'sair'){
            prompt = await MenuCLI.ask('Prompt (sair/exit) : ')
            if(prompt == 'exit' || prompt == 'sair'){break}
            let result = await ai.Generate(prompt,{tokenCallback : (token) => {console.log(token)}})
            console.log(result)
            console.log(`Tempo total : ${(result.timings.predicted_ms+result.timings.prompt_ms).toFixed(2)} ms | Tokens/Seg : ${(result.timings.predicted_per_second).toFixed(2)}`)
        }
        MenuCLI.displayMenu(SandboxMenu,{props : props})
    }
    },
    {
    name : 'ChatGPT',
    action : async () => {
        MenuCLI.close()
        console.clear()
        let ai = new EasyAI(props)
        const chat = new Chat()
        new TerminalChat(async (input,displayToken) => {
            chat.NewMessage('User: ',input)
            let historical_prompt = ''
            chat.Historical.forEach(e => {
             historical_prompt = `${historical_prompt}${e.Sender}${e.Content} | `
            })
            let result = await ai.Generate(`${ChatPrompt}${historical_prompt}AI:`,{tokenCallback : async (token) => {await displayToken(token.stream.content)},stop : ['|']})
            chat.NewMessage('AI: ',result.full_text)
        },{exitFunction : async () => {
            MenuCLI.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
              });
            await MenuCLI.displayMenu(SandboxMenu,{props : props})
        }})

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