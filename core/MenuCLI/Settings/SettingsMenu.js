import MenuCLI from "../MenuCLI.js"
import StartMenu from "../StartMenu.js"
import ConfigManager from '../../ConfigManager.js'
import ColorText from '../../useful/ColorText.js'
import FlashMenu from "./FlashMenu.js"
import RequirementsMenu from "../Requirements/RequirementsMenu.js"
import { cpus } from 'os';
import MiscMenu from "./MiscMenu.js"
import LlamaCPP_Menu from "./LlamaCPP_Menu.js"
import TextGeneration_Menu from "./TextGeneration_Menu.js"
import ServerSettings from "./ServerSettings.js"

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

const SettingsMenu = () => ({
    title : `• Settings`,
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
        name : `${ColorText.brightBlue('Server')} `,
        action : () => {
            MenuCLI.displayMenu(ServerSettings)
        }
        
    },
    {
        name : `${ColorText.brightBlue('Text Generation')} `,
        action : () => {
        MenuCLI.displayMenu(TextGeneration_Menu)
            }
        
    },
    
    {
        name : 'Flash Commands',
        action : () => {
            MenuCLI.displayMenu(FlashMenu)
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
        name : '← Back',
        action : () => {
            MenuCLI.displayMenu(StartMenu)
            }
        }
     ]

})

export default SettingsMenu