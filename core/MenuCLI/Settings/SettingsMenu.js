import MenuCLI from "../MenuCLI.js"
import StartMenu from "../StartMenu.js"
import ConfigManager from '../../ConfigManager.js'
import ColorText from '../../useful/ColorText.js'

const SettingsMenu = () => ({
    title : `✏️ Settings
`,
options : [
    {
        name : `Start ${ColorText.cyan('w/PM2')} | ${(ConfigManager.getKey('start-pm2') ? ColorText.green('ON') : ColorText.red('OFF'))}`,
        action : () => {
            if(ConfigManager.getKey('start-pm2')){
                ConfigManager.setKey('start-pm2',false)
            } else {
                ConfigManager.setKey('start-pm2',true)
            }
            MenuCLI.displayMenu(SettingsMenu)
        }
        },
    {
    name : `Start ${ColorText.cyan('w/CUDA')} | ${(ConfigManager.getKey('start-cuda') ? ColorText.green('ON') : ColorText.red('OFF'))}`,
    action : () => {
        if(ConfigManager.getKey('start-cuda')){
            ConfigManager.setKey('start-cuda',false)
        } else {
            ConfigManager.setKey('start-cuda',true)
        }
        MenuCLI.displayMenu(SettingsMenu)
    }
    },
    {
    name : (ConfigManager.getKey('openai') ? ColorText.green('OpenAI') : ColorText.red('OpenAI')),
    action : async () => {
        if(ConfigManager.getKey('openai')){
            let actual = ConfigManager.getKey('openai')
            let response = await MenuCLI.ask('Edit',{options : [`Token`,`Model (${ColorText.cyan(actual.model)})`,'Cancel']})
            switch (response) {
                case 'Token':
                    actual.token = await MenuCLI.ask('OpenAI Token : ')
                    ConfigManager.setKey('openai',actual)
                    MenuCLI.displayMenu(SettingsMenu)
                break;

                case `Model (${ColorText.cyan(actual.model)})`:
                    actual.model = await MenuCLI.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
                    ConfigManager.setKey('openai',actual)
                    MenuCLI.displayMenu(SettingsMenu)
                    break;
            
                default:
                    MenuCLI.displayMenu(SettingsMenu)
                break;
            }
        } else {
            let final_object = {}
            final_object.token = await MenuCLI.ask('OpenAI Token : ')
            final_object.model = await MenuCLI.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
            ConfigManager.setKey('openai',final_object)
            MenuCLI.displayMenu(SettingsMenu)
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

export default SettingsMenu