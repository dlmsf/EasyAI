import ServerMenu from "./ServerMenu.js";
import MenuCLI from "./MenuCLI.js";
import SandboxConfig from "./Sandbox/SandboxConfig.js";
import RequirementsMenu from "./Requirements/RequirementsMenu.js";

const StartMenu = () => ({
    title : `✔️ EasyAI
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
    },
    {
        name : '⚙️ Requirements',
        action : () => {
            MenuCLI.displayMenu(RequirementsMenu)
            }
        },
        {
            name : '📦 Misc.',
            action : () => {
                }
            }
     ]

})

export default StartMenu