import ServerMenu from "./ServerMenu.js";
import MenuCLI from "./MenuCLI.js";
import SandboxConfig from "./Sandbox/SandboxConfig.js";

const StartMenu = () => ({
    title : `⚙️ EasyAI
`,
options : [
    {
    name : '◆ EasyAI Server',
    action : () => {
        MenuCLI.displayMenu(ServerMenu)
    }
    },
    {
    name : '☕ Sandbox',
    action : () => {
        MenuCLI.displayMenu(SandboxConfig)
        }
    }
     ]

})

export default StartMenu