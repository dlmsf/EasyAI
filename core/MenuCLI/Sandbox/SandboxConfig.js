import StartMenu from '../StartMenu.js'
import MenuCLI from '../MenuCLI.js'
import SandboxMenu from './SandboxMenu.js'
import ConfigManager from '../../ConfigManager.js'
import ColorText from '../../useful/ColorText.js'

let instance_config = {server_url : 'localhost',server_port : 4000}

const SandboxConfig = () => ({
    title : `• Sandbox Config

${instance_config.openai_token ? 'OpenAI': `URL : ${instance_config.server_url}${(instance_config.server_port) ? `:${instance_config.server_port}` : ''}`}
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
        delete instance_config.openai_token
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
        name : (instance_config.server_token) ? ColorText.green('🔑 Access Token') : ColorText.red('🔑 Access Token'),
        action : async () => {
            if(instance_config.server_token){
                let response = await MenuCLI.ask('Edit Token',{options : ['New Token','Clear Token','Cancel']})
                switch (response) {
                    case 'New Token':
                        let token =  await MenuCLI.ask('Set Token : ')
                        instance_config.server_token = token
                          MenuCLI.displayMenu(SandboxConfig)
                    break;

                    case 'Clear Token':
                        instance_config.server_token = undefined
                          MenuCLI.displayMenu(SandboxConfig)
                    break;
                
                    default:
                          MenuCLI.displayMenu(SandboxConfig)
                    break;
                }
            } else {
                let token = await MenuCLI.ask('Set Token : ')
                instance_config.server_token = token
                  MenuCLI.displayMenu(SandboxConfig)
            }
          }
        },
    {
    name : ConfigManager.getKey('openai') ? `🌟 ${ColorText.green('OpenAI')}` : `🌟 ${ColorText.red('OpenAI')}`,
    action : async () => {
            if(ConfigManager.getKey('openai')){
                let obj = ConfigManager.getKey('openai')
                instance_config.openai_token = obj.token
                instance_config.openai_model = obj.model
                delete instance_config.server_port
                delete instance_config.server_url
                MenuCLI.displayMenu(SandboxConfig)
            } else {
                let final_object = {}
                final_object.token = await MenuCLI.ask('OpenAI Token : ')
                final_object.model = await MenuCLI.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
                if(await MenuCLI.ask('Save key and model?',{options : ['yes','no']}) == 'yes'){ConfigManager.setKey('openai',final_object)}
                instance_config.openai_token = final_object.token
                instance_config.openai_model = final_object.model
                delete instance_config.server_port
                delete instance_config.server_url
                MenuCLI.displayMenu(SandboxConfig)
            }
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