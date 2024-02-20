import ServerMenu from "./ServerMenu.js";
import MenuCLI from "./MenuCLI.js";
import SandboxMenu from "./Sandbox/SandboxMenu.js";

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
        MenuCLI.displayMenu(SandboxMenu)
        }
    }
     ]

})

export default StartMenu