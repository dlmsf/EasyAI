import ConfigManager from "../../ConfigManager.js"
import ColorText from '../../useful/ColorText.js'
import MenuCLI from "../MenuCLI.js"
import RequirementsMenu from "../Requirements/RequirementsMenu.js"
import SettingsMenu from "./SettingsMenu.js"

const ServerSettings = () => ({
    title : `• Settings / Server Settings`,
options : [
    {
        name : `Start ${ColorText.cyan('w/PM2')} | ${(ConfigManager.getKey('start-pm2') ? ColorText.green('ON') : ColorText.red('OFF'))}`,
        action : () => {
            if(ConfigManager.getKey('start-pm2')){
                ConfigManager.deleteKey('start-pm2')
            } else {
                ConfigManager.setKey('start-pm2',true)
            }
            MenuCLI.displayMenu(ServerSettings)
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

export default ServerSettings