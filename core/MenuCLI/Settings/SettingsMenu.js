import MenuCLI from "../MenuCLI.js"
import StartMenu from "../StartMenu.js"
import ConfigManager from '../../ConfigManager.js'
import ColorText from '../../useful/ColorText.js'
import FlashMenu from "./FlashMenu.js"
import RequirementsMenu from "../Requirements/RequirementsMenu.js"
import { cpus } from 'os';
import MiscMenu from "./MiscMenu.js"

export class ThreadDetector {
    static getSystemThreads() {
        try {
            const logicalCores = cpus().length; // Each logical core can handle a thread
            return logicalCores;
        } catch (error) {
            console.error('Error detecting system threads:', error.message);
            return false; // Return false if there's an issue
        }
    }
}

const LlamaCPP_Menu = () => ({
    title : `• Settings / LlamaCPP Menu
`,
options : [
    {
        name : `Install | ${ConfigManager.getKey('gh-llama') ? ColorText.cyan('GitHub') : ColorText.yellow('Native')}`,
        action : () => {
            if(ConfigManager.getKey('gh-llama')){
                ConfigManager.deleteKey('gh-llama')
            } else {
                ConfigManager.setKey('gh-llama',true)
            }
            MenuCLI.displayMenu(LlamaCPP_Menu)
        } 
        },
        {
            name : `Server Command-line | ${ConfigManager.getKey('old-llama-server') ?  ColorText.yellow('server') : ColorText.cyan('llama-server')}`,
            action : () => {
                if(ConfigManager.getKey('old-llama-server')){
                    ConfigManager.deleteKey('old-llama-server')
                } else {
                    ConfigManager.setKey('old-llama-server',true)
                }
                MenuCLI.displayMenu(LlamaCPP_Menu)
            } 
            },
            {
                name : 'Install (Requirements Menu)',
                action : () => {
                    MenuCLI.displayMenu(RequirementsMenu)
                    }
                },
            {
                name : '← Voltar - Settings MainMenu',
                action : () => {
                    MenuCLI.displayMenu(SettingsMenu)
                    }
                }
    ]

})

const SettingsMenu = () => ({
    title : `• Settings
`,
options : [
    {   
        //caso de uso legal para utilizar o terminalHUD com < >
        name : `Run Mode | ${['⭐', '🚧', '⚒️', '🥵'].includes(ConfigManager.getKey('mode')) ? ConfigManager.getKey('mode') : '⚒️'}`,
        action : () => {

            let key = ConfigManager.getKey('mode')

            if(key){
                
                switch (key) {
                    case '🥵':
                        ConfigManager.setKey('mode','⭐')
                    break;

                    case '⭐':
                        ConfigManager.setKey('mode','🚧')
                    break;

                    case '🚧':
                        ConfigManager.setKey('mode','⚒️')
                    break;
                
                    case '⚒️':
                        ConfigManager.setKey('mode','🥵')
                    break;

                    default :
                    ConfigManager.setKey('mode','🥵')
                    break
                    
                }
            } else {
                ConfigManager.setKey('mode','🥵')
            }
            MenuCLI.displayMenu(SettingsMenu)
        }
    },
    {
        name : `Start ${ColorText.cyan('w/PM2')} | ${(ConfigManager.getKey('start-pm2') ? ColorText.green('ON') : ColorText.red('OFF'))}`,
        action : () => {
            if(ConfigManager.getKey('start-pm2')){
                ConfigManager.deleteKey('start-pm2')
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
            ConfigManager.deleteKey('start-cuda')
        } else {
            ConfigManager.setKey('start-cuda',true)
        }
        MenuCLI.displayMenu(SettingsMenu)
    }
    },
    {
    name : `LlamaCPP`,
    action : () => {
        MenuCLI.displayMenu(LlamaCPP_Menu)
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
                    MenuCLI.displayMenu(SettingsMenu)
                break;

                case `Model (${ColorText.cyan(actual.model)})`:
                    actual.model = await MenuCLI.ask('Select the model',{options : ['gpt-3.5-turbo','gpt-4','gpt-4-turbo-preview','gpt-3.5-turbo-instruct']})
                    ConfigManager.setKey('openai',actual)
                    MenuCLI.displayMenu(SettingsMenu)
                    break;

                    case `🗑️ Clear`:
                       ConfigManager.deleteKey('openai')
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
        name : 'Flash Commands',
        action : () => {
            MenuCLI.displayMenu(FlashMenu)
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
                MenuCLI.displayMenu(SettingsMenu)    
            }
            },
            {
                name : `Fast Build | ${(  ConfigManager.getKey('jbuild') ?  (ConfigManager.getKey('jbuild-threads') ? ColorText.green(ConfigManager.getKey('jbuild-threads')) : ColorText.green('ON') ) : ColorText.red('OFF')   )}`,
                action : async () => {

                    const Threads = ThreadDetector.getSystemThreads()

                    if(Threads){

                        if(ConfigManager.getKey('jbuild-threads')){

                            let jbuild_threads = Number(ConfigManager.getKey('jbuild-threads'))
                                
                            if(jbuild_threads == Threads){

                                ConfigManager.deleteKey('jbuild')
                                ConfigManager.deleteKey('jbuild-threads')
                                
                                
                            } else {

                                jbuild_threads = jbuild_threads+1
                                ConfigManager.setKey('jbuild-threads',jbuild_threads)

                            }

                        } else {

                                ConfigManager.setKey('jbuild',true)
                                ConfigManager.setKey('jbuild-threads',1)
                        
                        }

                    } else {

                        if(ConfigManager.getKey('jbuild')){
                            ConfigManager.deleteKey('jbuild')
                        } else {
                            ConfigManager.setKey('jbuild',true)
                        }

                    }

                    MenuCLI.displayMenu(SettingsMenu)
                    
                }
                },
                {
                    name : `Log | ${(ConfigManager.getKey('log') ? ColorText.green('ON') : ColorText.red('OFF'))}`,
                    action : () => {
                        if(ConfigManager.getKey('log')){
                            ConfigManager.deleteKey('log')
                        } else {
                            ConfigManager.setKey('log',true)
                        }
                        MenuCLI.displayMenu(SettingsMenu)
                    }
                    },
                    {
                        name : ColorText.orange('Requirements'),
                        action : () => {
                            MenuCLI.displayMenu(RequirementsMenu)
                            }
                        },
                    {
                        name : ColorText.yellow('Misc'),
                        action : () => {
                            MenuCLI.displayMenu(MiscMenu)
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