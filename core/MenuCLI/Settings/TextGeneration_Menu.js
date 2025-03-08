import ConfigManager from "../../ConfigManager.js"
import ColorText from '../../useful/ColorText.js'
import MenuCLI from "../MenuCLI.js"
import SettingsMenu from "./SettingsMenu.js"
import LlamaCPP_Menu from "./LlamaCPP_Menu.js"

const TextGeneration_Menu = () => ({
    title : `• Settings / Text Generation`,
options : [
    {
        name : `LlamaCPP`,
        action : () => {
            MenuCLI.displayMenu(LlamaCPP_Menu)
        } 
        },
        {
            name : `Auto Model | ${ConfigManager.getKey('automodel-smaller') ? ColorText.cyan('Smaller') : ColorText.magenta('Bigger') }`,
            action : () => {
                if(ConfigManager.getKey('automodel-smaller')){
                    ConfigManager.deleteKey('automodel-smaller')
                } else {
                    ConfigManager.setKey('automodel-smaller',true)
                }
                MenuCLI.displayMenu(TextGeneration_Menu)    
            }
            },
    {
        name : `Start ${ColorText.cyan('w/CUDA')} | ${(ConfigManager.getKey('start-cuda') ? ColorText.green('ON') : ColorText.red('OFF'))}`,
        action : () => {
            if(ConfigManager.getKey('start-cuda')){
                ConfigManager.deleteKey('start-cuda')
            } else {
                ConfigManager.setKey('start-cuda',true)
            }
            MenuCLI.displayMenu(TextGeneration_Menu)
        }
        },
        {
            name : (ConfigManager.getKey('openai') ? ColorText.green('OpenAI') : ColorText.red('OpenAI')),
            action : async () => {
                if(ConfigManager.getKey('openai')){
                    let actual = ConfigManager.getKey('openai')
                    let response = await MenuCLI.ask('Edit',{options : [`Token`,`Model (${ColorText.cyan(actual.model)})`,'🗑️ Clear','Cancel']})
                    switch (response) {
                        case 'Token':
                            actual.token = await MenuCLI.ask('OpenAI Token : ')
                            ConfigManager.setKey('openai',actual)
                            MenuCLI.displayMenu(TextGeneration_Menu)
                        break;
        
                        case `Model (${ColorText.cyan(actual.model)})`:
                            actual.model = await MenuCLI.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
                            ConfigManager.setKey('openai',actual)
                            MenuCLI.displayMenu(TextGeneration_Menu)
                            break;
        
                            case `🗑️ Clear`:
                               ConfigManager.deleteKey('openai')
                                MenuCLI.displayMenu(TextGeneration_Menu)
                                break;
                            
                        default:
                            MenuCLI.displayMenu(TextGeneration_Menu)
                        break;
                    }
                } else {
                    let final_object = {}
                    final_object.token = await MenuCLI.ask('OpenAI Token : ')
                    final_object.model = await MenuCLI.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
                    ConfigManager.setKey('openai',final_object)
                    MenuCLI.displayMenu(TextGeneration_Menu)
                }
                
                }
            },
    {
        name : '← Back',
        action : () => {
            MenuCLI.displayMenu(SettingsMenu)
            }
        }
    ]

})

export default TextGeneration_Menu