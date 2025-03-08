import ServerMenu from "./ServerMenu.js";
import MenuCLI from "./MenuCLI.js";
import SandboxConfig from "./Sandbox/SandboxConfig.js";
import RequirementsMenu from "./Requirements/RequirementsMenu.js";
import SettingsMenu from "./Settings/SettingsMenu.js";
import PM2 from "../useful/PM2.js";

const StartMenu = () => ({
    title : ``,
options : [
    {
    name : '🌐 Server',
    action : () => {
        MenuCLI.displayMenu(ServerMenu)
    }
    },
    {
    name : '☕ Sandbox',
    action : () => {
        MenuCLI.displayMenu(SandboxConfig)
        }
    }, 
        {
            name : '⚙️  Settings',
            action : () => {
                MenuCLI.displayMenu(SettingsMenu)
                }
            }
     ]

})

export default StartMenu