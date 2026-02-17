import EasyAI from '../../../EasyAI.js'
import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'
import TerminalChat from '../../TerminalChat.js'
import readline from 'readline';
import Chat from '../../ChatModule/Chat.js'
import TerminalGenerate from '../../TerminalGenerate.js'
import ColorText from '../../useful/ColorText.js'
import PM2 from '../../useful/PM2.js'
import FreePort from '../../useful/FreePort.js'

let webgpt_processname

process.on('exit',async () => {
    if(webgpt_processname){
        await PM2.Delete(webgpt_processname)
    }
})

const SandboxMenu = async (props) => ({
    title : `☕ Sandbox | ${
        props.openai_token ? `OpenAI ${props.openai_model ? `(${ColorText.cyan(props.openai_model)})` : ''}` : 
        props.deepinfra_token ? `DeepInfra ${props.deepinfra_model ? `(${ColorText.cyan(props.deepinfra_model)})` : ''}` : 
        `${props.server_url}${(props.server_port) ? `:${props.server_port}` : ''}`
    }`,
options : [
    {
    name : ColorText.brightBlue('Generate'),
    action : async () => {
        MenuCLI.close()
        console.clear()
        let ai = new EasyAI(props)
        new TerminalGenerate(async (input,display) => {
           let result = await ai.Generate(input, {
               tokenCallback : async (token) => {
                   await display(token.stream.content)
               },
               ...(props.openai_token ? {openai: true} : {}),
               ...(props.deepinfra_token ? {deepinfra: true} : {})
           })
        },{exitFunction : async () => {
            MenuCLI.rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
              });
            await MenuCLI.displayMenu(SandboxMenu,{props : props})
        }})
    }
    },
    // Updated Chat action in SandboxMenu
{
    name : ColorText.brightBlue('Chat'),
    action : async () => {
        MenuCLI.close()
        console.clear()
        let ai = new EasyAI(props)
        const chat = new Chat()
        
        new TerminalChat(async (input, displayToken) => {
            // Add user message to chat history
            chat.NewMessage('user', input)
            
            // Convert chat history to messages array format
            const messages = chat.Historical.map(msg => ({
                role: msg.Sender === 'User: ' ? 'user' : 'assistant',
                content: msg.Content
            }))
            
            // Always use Chat() method - no more conditional logic
            const result = await ai.Chat(messages, {
                tokenCallback: async (token) => {
                    // Handle token in various formats
                    let content = ''
                    if (typeof token === 'string') {
                        content = token
                    } else if (token?.stream?.content) {
                        content = token.stream.content
                    } else if (token?.content) {
                        content = token.content
                    } else {
                        return // Skip unknown formats
                    }
                    await displayToken(content)
                },
                stream: true,
                // Let the AI decide when to stop - no stop tokens needed
                systemMessage: props.systemMessage, // Optional: custom system message
                systemType: props.systemType // Optional: CONCISE, DETAILED, etc.
            })
            
            // Add AI response to chat history
            if (result && result.full_text) {
                chat.NewMessage('assistant', result.full_text)
            }
            
        }, {
            exitFunction: async () => {
                MenuCLI.rl = readline.createInterface({
                    input: process.stdin,
                    output: process.stdout
                });
                await MenuCLI.displayMenu(SandboxMenu, { props: props })
            }
        })
    }
},
    {
    name : ColorText.blue('Coder'),
    action : async () => {
        await MenuCLI.displayMenu(SandboxMenu,{props : props})
        }
    },
    {
    name : ColorText.blue('AgentFlow'),
    action : async () => {
        await MenuCLI.displayMenu(SandboxMenu,{props : props})
          }
    },
    {
        name : `${ColorText.brightBlue('WebGPT Server')} | ${(await PM2.Process(webgpt_processname)) ? ColorText.green('ON') : ColorText.red('OFF')}`,
        action : async () => {

            if(await PM2.Process(webgpt_processname)){
                await PM2.Delete(webgpt_processname)
                webgpt_processname = undefined
                MenuCLI.displayMenu(SandboxMenu,{props : props,alert_emoji : '✔️',alert : 'WebGPT PM2 Server finalizado'})
            } else {
                let port = await FreePort(3000)
                webgpt_processname = await EasyAI.WebGPT.PM2({
                    port : port,
                    easyai_url : props.server_url,
                    easyai_port : props.server_port,
                    openai_token : props.openai_token,
                    openai_model : props.openai_model,
                    deepinfra_token : props.deepinfra_token,
                    deepinfra_model : props.deepinfra_model
                })
                MenuCLI.displayMenu(SandboxMenu,{props : props,alert_emoji : '✔️',alert : 'WebGPT PM2 Server iniciado com sucesso !'})
            }
        }
    },
    {
        name : '← Back',
        action : () => {
            MenuCLI.displayMenu(StartMenu)
            }
        }
     ]

})

export default SandboxMenu